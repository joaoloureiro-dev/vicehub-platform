import {
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
