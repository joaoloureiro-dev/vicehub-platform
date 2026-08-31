import {
    SourceType,
    TransactionDirection,
    TransactionStatus,
    type DatabaseClient,
} from '@vicehub/database';

import type { WalletOwner } from '../types/treasury.types.js';

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
