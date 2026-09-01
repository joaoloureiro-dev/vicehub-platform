import {
    DistributionBasis,
    DistributionStatus,
    TransactionCategory,
    TransactionDirection,
    TransactionStatus,
} from '@vicehub/database';

import { TreasuryError } from '../errors/treasury.errors.js';
import {
    InsufficientFundsSignal,
    type TreasuryRepository,
} from '../repositories/treasury.repository.js';
import { splitEqually, sumShares, type SplitShare } from './split.js';
import type {
    TreasuryBalances,
    TreasuryMovement,
    WalletOwner,
    WalletOwnerKind,
} from '../types/treasury.types.js';

interface ProposeDistributionInput {
    total?: bigint | undefined;
    basis: 'equal' | 'manual';
    note?: string | undefined;
    shares?: SplitShare[] | undefined;
    requestedBy: string;
}

interface ProposeMovementInput {
    amount: bigint;
    direction: TransactionDirection;
    category: TransactionCategory;
    description: string;
    requestedBy: string;
}

/**
 * Serviço de tesouraria.
 *
 * A tesouraria movimenta moeda de jogo, e não dinheiro real: não há
 * provedor de pagamento nem obrigações de reporte por trás dela. O rigor
 * é o mesmo — uma comunidade que perde a conta ao que dividiu perde a
 * confiança de quem contribuiu.
 *
 * Todo o movimento nasce por responder. Quem propõe e quem aprova são
 * permissões distintas, e o dinheiro só se mexe na aprovação.
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
     * Propõe um movimento, que fica por decidir.
     */
    async proposeMovement(owner: WalletOwner, input: ProposeMovementInput) {
        const wallet = await this.requireWallet(owner);

        return this.treasuryRepository.createMovement({
            walletId: wallet.id,
            amount: input.amount,
            direction: input.direction,
            category: input.category,
            description: input.description,
            requestedBy: input.requestedBy,
        });
    }

    /**
     * Aprova um movimento e move o dinheiro.
     */
    async approveMovement(
        owner: WalletOwner,
        movementId: string,
        approvedBy: string,
    ) {
        const { wallet, movement } = await this.requirePendingMovement(
            owner,
            movementId,
        );

        try {
            const resultado = await this.treasuryRepository.approveMovement({
                movementId: movement.id,
                walletId: wallet.id,
                amount: movement.amount,
                direction: movement.direction,
                approvedBy,
            });

            if (resultado.outcome === 'not_pending') {
                /**
                 * Outra aprovação chegou primeiro. O movimento já não é
                 * desta pessoa para aprovar, e o dinheiro não se mexeu
                 * duas vezes.
                 */
                throw new TreasuryError(
                    'MOVEMENT_NOT_PENDING',
                    'Este movimento já foi decidido.',
                );
            }
        } catch (error) {
            if (error instanceof InsufficientFundsSignal) {
                throw new TreasuryError(
                    'INSUFFICIENT_FUNDS',
                    'A tesouraria não tem saldo suficiente para este movimento.',
                );
            }

            throw error;
        }

        return this.treasuryRepository.findMovementById(movement.id);
    }

    /**
     * Recusa um movimento. O saldo não se mexe.
     */
    async rejectMovement(
        owner: WalletOwner,
        movementId: string,
        rejectedBy: string,
    ) {
        const { movement } = await this.requirePendingMovement(owner, movementId);

        await this.closeOrFail(movement.id, TransactionStatus.rejected, rejectedBy);

        return this.treasuryRepository.findMovementById(movement.id);
    }

    /**
     * Retira uma proposta ainda por decidir.
     *
     * Só quem a propôs a pode retirar. Cancelar a proposta de outra
     * pessoa é uma decisão, e decisões passam por recusar — que fica
     * registada com quem a tomou.
     */
    async cancelMovement(
        owner: WalletOwner,
        movementId: string,
        canceledBy: string,
    ) {
        const { movement } = await this.requirePendingMovement(owner, movementId);

        if (movement.requested_by !== canceledBy) {
            throw new TreasuryError(
                'NOT_THE_PROPOSER',
                'Só quem propôs o movimento o pode retirar. Para o travar, recusa-o.',
            );
        }

        await this.closeOrFail(movement.id, TransactionStatus.canceled, canceledBy);

        return this.treasuryRepository.findMovementById(movement.id);
    }

    /**
     * Propõe uma divisão de ganhos pelos membros.
     *
     * O cálculo da divisão é separado de quem o pediu: em partes iguais
     * é feito aqui, manualmente vem indicado, e uma sugestão automática
     * entra pelo mesmo caminho. Seja quem for a calcular, a proposta fica
     * pendente e é o líder que decide.
     */
    async proposeDistribution(owner: WalletOwner, input: ProposeDistributionInput) {
        const wallet = await this.requireWallet(owner);

        /**
         * Os membros são lidos aqui, e não enviados no pedido: quem
         * propõe não pode escolher a quem paga numa divisão em partes
         * iguais.
         */
        const memberIds = await this.treasuryRepository.listActiveMemberIds(owner);

        if (memberIds.length === 0) {
            throw new TreasuryError(
                'NO_MEMBERS_TO_PAY',
                'Esta crew não tem membros a quem distribuir.',
            );
        }

        const { total, shares } = this.buildShares(input, memberIds);

        /**
         * A soma das partes tem de ser exatamente o total. Se não for, a
         * tesouraria ficaria com dinheiro a mais ou a menos que ninguém
         * sabe explicar — por isso falha aqui, e não depois de gravar.
         */
        if (sumShares(shares) !== total) {
            throw new TreasuryError(
                'SHARES_DO_NOT_MATCH_TOTAL',
                'A soma das partes não corresponde ao total da divisão.',
            );
        }

        const carteiras = await this.treasuryRepository.ensureWalletsForUsers(
            shares.map((share) => share.userId),
        );

        return this.treasuryRepository.createDistribution({
            walletId: wallet.id,
            total,
            basis:
                input.basis === 'equal'
                    ? DistributionBasis.equal
                    : DistributionBasis.manual,
            note: input.note,
            requestedBy: input.requestedBy,
            shares: shares
                .filter((share) => share.amount > 0n)
                .map((share) => ({
                    /**
                     * A carteira existe: acabámos de a garantir para
                     * todos os que recebem.
                     */
                    walletId: carteiras.get(share.userId) as string,
                    amount: share.amount,
                })),
        });
    }

    /**
     * Aprova a divisão inteira e paga a todos, ou não paga a ninguém.
     */
    async approveDistribution(
        owner: WalletOwner,
        distributionId: string,
        approvedBy: string,
    ) {
        const { wallet, distribution } = await this.requirePendingDistribution(
            owner,
            distributionId,
        );

        const credits = distribution.lines
            .filter((linha) => linha.direction === TransactionDirection.credit)
            .map((linha) => ({ walletId: linha.walletId, amount: linha.amount }));

        try {
            const resultado = await this.treasuryRepository.approveDistribution({
                distributionId: distribution.id,
                walletId: wallet.id,
                total: distribution.total,
                credits,
                approvedBy,
            });

            if (resultado.outcome === 'not_pending') {
                throw new TreasuryError(
                    'DISTRIBUTION_NOT_PENDING',
                    'Esta divisão já foi decidida.',
                );
            }
        } catch (error) {
            if (error instanceof InsufficientFundsSignal) {
                throw new TreasuryError(
                    'INSUFFICIENT_FUNDS',
                    'A tesouraria não tem saldo suficiente para esta divisão.',
                );
            }

            throw error;
        }

        return this.treasuryRepository.findDistributionById(distribution.id);
    }

    async rejectDistribution(
        owner: WalletOwner,
        distributionId: string,
        rejectedBy: string,
    ) {
        const { distribution } = await this.requirePendingDistribution(
            owner,
            distributionId,
        );

        const fechada = await this.treasuryRepository.closeDistribution({
            distributionId: distribution.id,
            status: DistributionStatus.rejected,
            lineStatus: TransactionStatus.rejected,
            decidedBy: rejectedBy,
        });

        if (fechada.count !== 1) {
            throw new TreasuryError(
                'DISTRIBUTION_NOT_PENDING',
                'Esta divisão já foi decidida.',
            );
        }

        return this.treasuryRepository.findDistributionById(distribution.id);
    }

    listDistributions(owner: WalletOwner, limit: number) {
        return this.requireWallet(owner).then((wallet) =>
            this.treasuryRepository.listDistributions(wallet.id, limit),
        );
    }

    /**
     * Calcula as partes conforme a base pedida.
     */
    private buildShares(
        input: ProposeDistributionInput,
        memberIds: string[],
    ): {
        total: bigint;
        shares: SplitShare[];
    } {
        if (input.basis === 'equal') {
            const total = input.total ?? 0n;

            return { total, shares: splitEqually(total, memberIds) };
        }

        const shares = input.shares ?? [];

        /**
         * Numa divisão manual o total é o que as partes somam, e não um
         * número enviado à parte: assim não pode haver desacordo entre os
         * dois.
         */
        return { total: sumShares(shares), shares };
    }

    private async requirePendingDistribution(
        owner: WalletOwner,
        distributionId: string,
    ) {
        const wallet = await this.requireWallet(owner);

        const distribution =
            await this.treasuryRepository.findDistributionById(distributionId);

        /**
         * A mesma verificação de âmbito dos movimentos: sem ela, quem
         * manda numa crew aprovaria divisões de outra.
         */
        if (!distribution || distribution.walletId !== wallet.id) {
            throw new TreasuryError(
                'DISTRIBUTION_NOT_FOUND',
                'Não existe essa divisão nesta tesouraria.',
            );
        }

        if (distribution.status !== DistributionStatus.pending) {
            throw new TreasuryError(
                'DISTRIBUTION_NOT_PENDING',
                'Esta divisão já foi decidida.',
            );
        }

        return { wallet, distribution };
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

    /**
     * Carrega um movimento pendente, confirmando que pertence mesmo à
     * tesouraria indicada na rota.
     *
     * Esta verificação é o que impede a confusão de âmbito: sem ela,
     * quem tem autorização na crew A aprovaria um movimento da crew B
     * pondo o identificador da sua no caminho, e o guard de permissões
     * não daria por nada — ele só olha para o parâmetro da rota.
     */
    private async requirePendingMovement(owner: WalletOwner, movementId: string) {
        const wallet = await this.requireWallet(owner);

        const movement = await this.treasuryRepository.findMovementById(movementId);

        if (!movement || movement.walletId !== wallet.id) {
            throw new TreasuryError(
                'MOVEMENT_NOT_FOUND',
                'Não existe esse movimento nesta tesouraria.',
            );
        }

        if (movement.status !== TransactionStatus.pending) {
            throw new TreasuryError(
                'MOVEMENT_NOT_PENDING',
                'Este movimento já foi decidido.',
            );
        }

        return { wallet, movement };
    }

    /**
     * Encerra um movimento, recusando se entretanto deixou de estar
     * pendente.
     */
    private async closeOrFail(
        movementId: string,
        status: TransactionStatus,
        decidedBy: string,
    ): Promise<void> {
        const fechado = await this.treasuryRepository.closeMovement({
            movementId,
            status,
            decidedBy,
        });

        if (fechado.count !== 1) {
            throw new TreasuryError(
                'MOVEMENT_NOT_PENDING',
                'Este movimento já foi decidido.',
            );
        }
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
