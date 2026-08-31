import { TransactionDirection, TransactionStatus } from '@vicehub/database';

import { TreasuryError } from '../errors/treasury.errors.js';
import type { TreasuryRepository } from '../repositories/treasury.repository.js';
import type {
    TreasuryBalances,
    TreasuryMovement,
    WalletOwner,
    WalletOwnerKind,
} from '../types/treasury.types.js';

/**
 * Serviço de tesouraria.
 *
 * Por agora só responde a duas perguntas: quanto há, e o que se passou.
 * Propor e aprovar movimentos vêm a seguir, e é por isso que os estados
 * e os CHECK já existem na base de dados.
 */
export class TreasuryService {
    constructor(private readonly treasuryRepository: TreasuryRepository) { }

    /**
     * Devolve os três saldos de um titular.
     */
    async getBalances(owner: WalletOwner): Promise<TreasuryBalances> {
        const wallet = await this.requireWallet(owner);

        const pendentes = await this.treasuryRepository.sumByDirection(
            wallet.id,
            TransactionStatus.pending,
        );

        const pendingIn = this.sumOf(pendentes, TransactionDirection.credit);
        const pendingOut = this.sumOf(pendentes, TransactionDirection.debit);

        /**
         * O disponível desconta as saídas já propostas mas ainda por
         * decidir. Sem esse desconto, o mesmo dinheiro seria comprometido
         * duas vezes: duas despesas aprovadas em separado caberiam ambas
         * no saldo liquidado e nenhuma delas no que resta.
         *
         * As entradas pendentes não somam: ainda não entrou nada.
         */
        const available = wallet.balance - pendingOut;

        return {
            settled: wallet.balance,
            pendingIn,
            pendingOut,
            available,
        };
    }

    async listMovements(
        owner: WalletOwner,
        limit: number,
        status?: TransactionStatus | undefined,
    ): Promise<TreasuryMovement[]> {
        const wallet = await this.requireWallet(owner);

        const movimentos = await this.treasuryRepository.listMovements(
            wallet.id,
            limit,
            status,
        );

        return movimentos.map((movimento) => ({
            id: movimento.id,
            amount: movimento.amount,
            direction: movimento.direction,
            category: movimento.category,
            status: movimento.status,
            description: movimento.description,
            requestedBy: movimento.requested_by,
            decidedBy: movimento.decided_by,
            decidedAt: movimento.decided_at,
            createdAt: movimento.created_at,
        }));
    }

    /**
     * Confirma que o saldo guardado bate certo com as movimentações.
     *
     * O saldo da carteira é uma cache. Esta reconciliação é o que impede
     * que uma divergência passe despercebida.
     */
    async reconcile(
        owner: WalletOwner,
    ): Promise<{ stored: bigint; recomputed: bigint; matches: boolean }> {
        const wallet = await this.requireWallet(owner);

        const recomputed = await this.treasuryRepository.recomputeSettledBalance(
            wallet.id,
        );

        return {
            stored: wallet.balance,
            recomputed,
            matches: wallet.balance === recomputed,
        };
    }

    buildOwner(kind: WalletOwnerKind, id: string): WalletOwner {
        if (kind === 'user') {
            return { userId: id };
        }

        return kind === 'crew' ? { crewId: id } : { serverId: id };
    }

    /**
     * Devolve a carteira do titular, criando-a se ainda não existir.
     *
     * As carteiras passaram a nascer com a entidade, mas as contas e
     * crews criadas antes disso não têm nenhuma. Criar aqui evita que a
     * tesouraria falhe para elas.
     */
    private async requireWallet(owner: WalletOwner) {
        this.assertSingleOwner(owner);

        const existente = await this.treasuryRepository.findWalletByOwner(owner);

        if (existente) {
            return existente;
        }

        return this.treasuryRepository.createWalletForOwner(owner);
    }

    private sumOf(
        somas: { direction: TransactionDirection; _sum: { amount: bigint | null } }[],
        direction: TransactionDirection,
    ): bigint {
        return (
            somas.find((linha) => linha.direction === direction)?._sum.amount ?? 0n
        );
    }

    private assertSingleOwner(owner: WalletOwner): void {
        const provided = [owner.userId, owner.crewId, owner.serverId].filter(
            (value) => value !== undefined && value !== null,
        );

        if (provided.length !== 1) {
            throw new TreasuryError(
                'INVALID_WALLET_OWNER',
                'Uma carteira tem exatamente um titular: utilizador, crew ou servidor.',
            );
        }
    }
}
