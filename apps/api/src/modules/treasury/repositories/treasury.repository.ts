import {
    MembershipStatus,
    MembershipType,
    DistributionBasis,
    DistributionStatus,
    SourceType,
    TransactionCategory,
    TransactionDirection,
    TransactionStatus,
    type DatabaseClient,
} from '@vicehub/database';

import type { WalletOwner } from '../types/treasury.types.js';

/**
 * Sinal interno para desfazer a transação de aprovação quando o saldo
 * não chega. Não sai do repositório: o serviço traduz o resultado num
 * erro de domínio.
 */
export class InsufficientFundsSignal extends Error {
    constructor() {
        super('Saldo insuficiente.');

        this.name = 'InsufficientFundsSignal';
    }
}

/**
 * Repositório da tesouraria.
 */
export class TreasuryRepository {
    constructor(private readonly database: DatabaseClient) { }

    findWalletByOwner(owner: WalletOwner) {
        return this.database.wallet.findFirst({
            where: {
                ...this.ownerFilter(owner),
                is_deleted: false,
            },
        });
    }

    /**
     * Cria a carteira em falta de um titular.
     *
     * As carteiras nascem com a entidade; isto existe apenas para as
     * contas, crews e servidores criados antes de isso passar a
     * acontecer.
     */
    createWalletForOwner(owner: WalletOwner) {
        return this.database.wallet.create({
            data: {
                userId: owner.userId ?? null,
                crewId: owner.crewId ?? null,
                serverId: owner.serverId ?? null,
                source: SourceType.api,
            },
        });
    }

    /**
     * Soma os montantes por sentido, para um dado estado.
     *
     * Uma única consulta agrupada em vez de uma por sentido: o extrato de
     * uma tesouraria movimentada não deve custar mais consultas por ter
     * mais linhas.
     */
    sumByDirection(walletId: string, status: TransactionStatus) {
        return this.database.transaction.groupBy({
            by: ['direction'],
            where: { walletId, status, is_deleted: false },
            _sum: { amount: true },
        });
    }

    listMovements(
        walletId: string,
        take: number,
        status?: TransactionStatus | undefined,
    ) {
        return this.database.transaction.findMany({
            where: {
                walletId,
                is_deleted: false,
                ...(status ? { status } : {}),
            },
            orderBy: { created_at: 'desc' },
            take,
        });
    }

    findMovementById(movementId: string) {
        return this.database.transaction.findFirst({
            where: { id: movementId, is_deleted: false },
        });
    }

    createMovement(input: {
        walletId: string;
        amount: bigint;
        direction: TransactionDirection;
        category: TransactionCategory;
        description: string;
        requestedBy: string;
    }) {
        return this.database.transaction.create({
            data: {
                walletId: input.walletId,
                amount: input.amount,
                direction: input.direction,
                category: input.category,
                description: input.description,
                status: TransactionStatus.pending,
                requested_by: input.requestedBy,
                source: SourceType.api,
            },
        });
    }

    /**
     * Aprova um movimento e move o dinheiro, tudo ou nada.
     *
     * A ordem é deliberada. Primeiro o movimento é reclamado com uma
     * escrita condicional ao estado pendente: das duas aprovações
     * simultâneas do mesmo movimento, só uma altera linha, e a outra
     * encontra zero e desiste. Sem isso, ambas passariam e o dinheiro
     * saía duas vezes.
     *
     * Só depois o saldo se mexe, e a saída é igualmente condicional ao
     * saldo chegar. Duas saídas diferentes aprovadas ao mesmo tempo não
     * conseguem ambas levar o mesmo dinheiro: a segunda não encontra
     * saldo suficiente e a transação inteira é desfeita.
     */
    approveMovement(input: {
        movementId: string;
        walletId: string;
        amount: bigint;
        direction: TransactionDirection;
        approvedBy: string;
    }) {
        return this.database.$transaction(async (tx) => {
            const reclamado = await tx.transaction.updateMany({
                where: { id: input.movementId, status: TransactionStatus.pending },
                data: {
                    status: TransactionStatus.approved,
                    decided_by: input.approvedBy,
                    decided_at: new Date(),
                    version: { increment: 1 },
                },
            });

            if (reclamado.count !== 1) {
                return { outcome: 'not_pending' as const };
            }

            if (input.direction === TransactionDirection.credit) {
                await tx.wallet.update({
                    where: { id: input.walletId },
                    data: {
                        balance: { increment: input.amount },
                        version: { increment: 1 },
                    },
                });

                return { outcome: 'approved' as const };
            }

            const debitado = await tx.wallet.updateMany({
                where: { id: input.walletId, balance: { gte: input.amount } },
                data: {
                    balance: { decrement: input.amount },
                    version: { increment: 1 },
                },
            });

            if (debitado.count !== 1) {
                /**
                 * Lançar desfaz a transação inteira, incluindo o estado
                 * do movimento: ele volta a pendente por si.
                 */
                throw new InsufficientFundsSignal();
            }

            return { outcome: 'approved' as const };
        });
    }

    /**
     * Encerra um movimento sem mexer no saldo.
     */
    closeMovement(input: {
        movementId: string;
        status: TransactionStatus;
        decidedBy: string;
    }) {
        return this.database.transaction.updateMany({
            where: { id: input.movementId, status: TransactionStatus.pending },
            data: {
                status: input.status,
                decided_by: input.decidedBy,
                decided_at: new Date(),
                version: { increment: 1 },
            },
        });
    }

    /**
     * Membros ativos de uma crew ou servidor, por ordem de antiguidade.
     *
     * A ordem importa: é por ela que o resto de uma divisão não exata é
     * repartido, e tem de ser sempre a mesma para a divisão ser
     * reproduzível.
     */
    async listActiveMemberIds(owner: WalletOwner): Promise<string[]> {
        /**
         * Os identificadores são fixados aqui em vez de passarem como
         * opcionais: com exactOptionalPropertyTypes, um undefined no
         * filtro deixaria de restringir e devolveria membros de todas as
         * crews.
         */
        const escopo =
            owner.crewId !== undefined && owner.crewId !== null
                ? { crewId: owner.crewId, type: MembershipType.crew }
                : { serverId: owner.serverId ?? '', type: MembershipType.server };

        const adesoes = await this.database.membership.findMany({
            where: {
                ...escopo,
                status: MembershipStatus.active,
                is_deleted: false,
            },
            orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
            select: { userId: true },
        });

        return adesoes.map((adesao) => adesao.userId);
    }

    /**
     * Garante que cada utilizador indicado tem carteira, e devolve o
     * identificador da de cada um.
     *
     * As carteiras nascem com a conta, mas as contas criadas antes disso
     * não têm nenhuma. Uma divisão não pode falhar a meio por causa de um
     * membro antigo.
     */
    async ensureWalletsForUsers(userIds: string[]): Promise<Map<string, string>> {
        const existentes = await this.database.wallet.findMany({
            where: { userId: { in: userIds }, is_deleted: false },
            select: { id: true, userId: true },
        });

        const porUtilizador = new Map<string, string>();

        for (const carteira of existentes) {
            if (carteira.userId !== null) {
                porUtilizador.set(carteira.userId, carteira.id);
            }
        }

        const emFalta = userIds.filter((userId) => !porUtilizador.has(userId));

        for (const userId of emFalta) {
            const criada = await this.database.wallet.create({
                data: { userId, source: SourceType.api },
            });

            porUtilizador.set(userId, criada.id);
        }

        return porUtilizador;
    }

    /**
     * Cria a divisão e as suas linhas na mesma transação.
     *
     * As linhas nascem todas pendentes: propor uma divisão não move
     * dinheiro nenhum, tal como propor um movimento.
     */
    createDistribution(input: {
        walletId: string;
        total: bigint;
        basis: DistributionBasis;
        note?: string | undefined;
        requestedBy: string;
        shares: { walletId: string; amount: bigint }[];
    }) {
        return this.database.$transaction(async (tx) => {
            const distribution = await tx.distribution.create({
                data: {
                    walletId: input.walletId,
                    total: input.total,
                    basis: input.basis,
                    status: DistributionStatus.pending,
                    note: input.note ?? null,
                    requested_by: input.requestedBy,
                    source: SourceType.api,
                    created_by: input.requestedBy,
                },
            });

            /**
             * A saída da tesouraria é uma linha só, com o total. As
             * entradas são uma por pessoa. Assim o extrato da crew mostra
             * uma despesa, e o de cada membro mostra o que recebeu.
             */
            await tx.transaction.create({
                data: {
                    walletId: input.walletId,
                    distributionId: distribution.id,
                    amount: input.total,
                    direction: TransactionDirection.debit,
                    category: TransactionCategory.payout,
                    status: TransactionStatus.pending,
                    description: 'Divisão de ganhos pelos membros',
                    requested_by: input.requestedBy,
                    source: SourceType.api,
                },
            });

            for (const share of input.shares) {
                await tx.transaction.create({
                    data: {
                        walletId: share.walletId,
                        distributionId: distribution.id,
                        amount: share.amount,
                        direction: TransactionDirection.credit,
                        category: TransactionCategory.payout,
                        status: TransactionStatus.pending,
                        description: 'Parte da divisão de ganhos',
                        requested_by: input.requestedBy,
                        source: SourceType.api,
                    },
                });
            }

            return distribution;
        });
    }

    findDistributionById(distributionId: string) {
        return this.database.distribution.findFirst({
            where: { id: distributionId, is_deleted: false },
            include: {
                lines: {
                    where: { is_deleted: false },
                    orderBy: { direction: 'asc' },
                },
            },
        });
    }

    listDistributions(walletId: string, take: number) {
        return this.database.distribution.findMany({
            where: { walletId, is_deleted: false },
            orderBy: { created_at: 'desc' },
            take,
            include: {
                lines: { where: { is_deleted: false } },
            },
        });
    }

    /**
     * Aprova a divisão inteira, ou nada.
     *
     * Segue a mesma ordem da aprovação de um movimento — reclamar
     * primeiro, mexer no dinheiro depois — e acrescenta o essencial de
     * uma divisão: ou entram todas as partes, ou não entra nenhuma. Se a
     * transação se desfizer a meio, não fica um membro pago e outro não.
     */
    approveDistribution(input: {
        distributionId: string;
        walletId: string;
        total: bigint;
        credits: { walletId: string; amount: bigint }[];
        approvedBy: string;
    }) {
        return this.database.$transaction(async (tx) => {
            const decididoEm = new Date();

            const reclamada = await tx.distribution.updateMany({
                where: {
                    id: input.distributionId,
                    status: DistributionStatus.pending,
                },
                data: {
                    status: DistributionStatus.approved,
                    decided_by: input.approvedBy,
                    decided_at: decididoEm,
                    version: { increment: 1 },
                },
            });

            if (reclamada.count !== 1) {
                return { outcome: 'not_pending' as const };
            }

            const debitada = await tx.wallet.updateMany({
                where: { id: input.walletId, balance: { gte: input.total } },
                data: {
                    balance: { decrement: input.total },
                    version: { increment: 1 },
                },
            });

            if (debitada.count !== 1) {
                throw new InsufficientFundsSignal();
            }

            for (const credit of input.credits) {
                await tx.wallet.update({
                    where: { id: credit.walletId },
                    data: {
                        balance: { increment: credit.amount },
                        version: { increment: 1 },
                    },
                });
            }

            await tx.transaction.updateMany({
                where: {
                    distributionId: input.distributionId,
                    status: TransactionStatus.pending,
                },
                data: {
                    status: TransactionStatus.approved,
                    decided_by: input.approvedBy,
                    decided_at: decididoEm,
                    version: { increment: 1 },
                },
            });

            return { outcome: 'approved' as const };
        });
    }

    /**
     * Encerra a divisão e as suas linhas sem mexer em saldo nenhum.
     */
    closeDistribution(input: {
        distributionId: string;
        status: DistributionStatus;
        lineStatus: TransactionStatus;
        decidedBy: string;
    }) {
        return this.database.$transaction(async (tx) => {
            const decididoEm = new Date();

            const fechada = await tx.distribution.updateMany({
                where: {
                    id: input.distributionId,
                    status: DistributionStatus.pending,
                },
                data: {
                    status: input.status,
                    decided_by: input.decidedBy,
                    decided_at: decididoEm,
                    version: { increment: 1 },
                },
            });

            if (fechada.count !== 1) {
                return { count: 0 };
            }

            await tx.transaction.updateMany({
                where: {
                    distributionId: input.distributionId,
                    status: TransactionStatus.pending,
                },
                data: {
                    status: input.lineStatus,
                    decided_by: input.decidedBy,
                    decided_at: decididoEm,
                    version: { increment: 1 },
                },
            });

            return { count: 1 };
        });
    }

    /**
     * Recalcula o saldo liquidado a partir das próprias movimentações.
     *
     * O saldo guardado na carteira é uma cache mantida por quem aprova.
     * Isto existe para o poder reconciliar: uma cache que ninguém
     * verifica acaba por divergir sem ninguém dar por isso.
     */
    async recomputeSettledBalance(walletId: string): Promise<bigint> {
        const somas = await this.sumByDirection(
            walletId,
            TransactionStatus.approved,
        );

        return somas.reduce((total, linha) => {
            const valor = linha._sum.amount ?? 0n;

            return linha.direction === TransactionDirection.credit
                ? total + valor
                : total - valor;
        }, 0n);
    }

    /**
     * Filtro pelo titular.
     *
     * Os campos ausentes são fixados a null e não omitidos: sem isso,
     * procurar pela carteira do utilizador devolveria também carteiras de
     * crews cujo userId calhasse ser nulo.
     */
    private ownerFilter(owner: WalletOwner) {
        return {
            userId: owner.userId ?? null,
            crewId: owner.crewId ?? null,
            serverId: owner.serverId ?? null,
        };
    }
}
