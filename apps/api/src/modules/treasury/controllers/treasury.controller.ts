import type { FastifyReply, FastifyRequest } from 'fastify';

import type {
    TransactionCategory,
    TransactionDirection,
    TransactionStatus,
} from '@vicehub/database';

import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import { AuditService } from '../../audit/services/audit.service.js';
import type {
    CrewDistributionParamDto,
    CrewMovementParamDto,
    ProposeDistributionDto,
    CrewTreasuryParamDto,
    ListMovementsQueryDto,
    ProposeMovementDto,
    ServerMovementParamDto,
    ServerTreasuryParamDto,
} from '../dto/treasury.dto.js';
import type { TreasuryService } from '../services/treasury.service.js';
import type { TreasuryMovement, WalletOwner } from '../types/treasury.types.js';

type MovementRow = {
    id: string;
    amount: bigint;
    direction: string;
    category: string;
    status: string;
    description: string | null;
    requested_by: string | null;
    decided_by: string | null;
    decided_at: Date | null;
    created_at: Date;
};

export class TreasuryController {
    constructor(
        private readonly treasuryService: TreasuryService,
        private readonly auditService: AuditService,
    ) { }

    async proposeCrewMovement(
        request: FastifyRequest<{
            Params: CrewTreasuryParamDto;
            Body: ProposeMovementDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.propose(request, reply, { crewId: request.params.crewId });
    }

    async proposeServerMovement(
        request: FastifyRequest<{
            Params: ServerTreasuryParamDto;
            Body: ProposeMovementDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.propose(request, reply, { serverId: request.params.serverId });
    }

    async approveCrewMovement(
        request: FastifyRequest<{ Params: CrewMovementParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.decide(request, reply, { crewId: request.params.crewId }, 'approve');
    }

    async approveServerMovement(
        request: FastifyRequest<{ Params: ServerMovementParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.decide(
            request,
            reply,
            { serverId: request.params.serverId },
            'approve',
        );
    }

    async rejectCrewMovement(
        request: FastifyRequest<{ Params: CrewMovementParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.decide(request, reply, { crewId: request.params.crewId }, 'reject');
    }

    async rejectServerMovement(
        request: FastifyRequest<{ Params: ServerMovementParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.decide(
            request,
            reply,
            { serverId: request.params.serverId },
            'reject',
        );
    }

    async cancelCrewMovement(
        request: FastifyRequest<{ Params: CrewMovementParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.decide(request, reply, { crewId: request.params.crewId }, 'cancel');
    }

    async cancelServerMovement(
        request: FastifyRequest<{ Params: ServerMovementParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.decide(
            request,
            reply,
            { serverId: request.params.serverId },
            'cancel',
        );
    }

    async getMine(
        request: FastifyRequest<{ Querystring: ListMovementsQueryDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        reply.send(await this.build({ userId: user.id }, request.query));
    }

    async getCrew(
        request: FastifyRequest<{
            Params: CrewTreasuryParamDto;
            Querystring: ListMovementsQueryDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        reply.send(
            await this.build({ crewId: request.params.crewId }, request.query),
        );
    }

    async getServer(
        request: FastifyRequest<{
            Params: ServerTreasuryParamDto;
            Querystring: ListMovementsQueryDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        reply.send(
            await this.build({ serverId: request.params.serverId }, request.query),
        );
    }

    async proposeCrewDistribution(
        request: FastifyRequest<{
            Params: CrewTreasuryParamDto;
            Body: ProposeDistributionDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const owner = { crewId: request.params.crewId };

        const distribution = await this.treasuryService.proposeDistribution(owner, {
            basis: request.body.basis,
            ...(request.body.total !== undefined
                ? { total: BigInt(request.body.total) }
                : {}),
            ...(request.body.note !== undefined ? { note: request.body.note } : {}),
            ...(request.body.shares !== undefined
                ? {
                    shares: request.body.shares.map((share) => ({
                        userId: share.userId,
                        amount: BigInt(share.amount),
                    })),
                }
                : {}),
            requestedBy: user.id,
        });

        await this.auditService.record({
            action: 'treasury.distribution.proposed',
            entityType: 'Distribution',
            entityId: distribution.id,
            actorId: user.id,
            after: {
                total: distribution.total.toString(),
                basis: distribution.basis,
            },
            ...AuditService.contextOf(request),
        });

        reply.code(201).send(await this.loadDistributionDto(owner, distribution.id));
    }

    async approveCrewDistribution(
        request: FastifyRequest<{ Params: CrewDistributionParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.decideDistribution(request, reply, 'approve');
    }

    async rejectCrewDistribution(
        request: FastifyRequest<{ Params: CrewDistributionParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.decideDistribution(request, reply, 'reject');
    }

    async listCrewDistributions(
        request: FastifyRequest<{
            Params: CrewTreasuryParamDto;
            Querystring: ListMovementsQueryDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        const distribuicoes = await this.treasuryService.listDistributions(
            { crewId: request.params.crewId },
            request.query.limit,
        );

        reply.send(distribuicoes.map((linha) => this.toDistributionDto(linha)));
    }

    private async decideDistribution(
        request: FastifyRequest<{ Params: CrewDistributionParamDto }>,
        reply: FastifyReply,
        decision: 'approve' | 'reject',
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const owner = { crewId: request.params.crewId };

        const distribution =
            decision === 'approve'
                ? await this.treasuryService.approveDistribution(
                    owner,
                    request.params.distributionId,
                    user.id,
                )
                : await this.treasuryService.rejectDistribution(
                    owner,
                    request.params.distributionId,
                    user.id,
                );

        if (!distribution) {
            reply.code(404).send();
            return;
        }

        await this.auditService.record({
            action: `treasury.distribution.${decision}d`,
            entityType: 'Distribution',
            entityId: distribution.id,
            actorId: user.id,
            before: { status: 'pending' },
            after: {
                status: distribution.status,
                total: distribution.total.toString(),
                lines: distribution.lines.length,
            },
            ...AuditService.contextOf(request),
        });

        reply.send(this.toDistributionDto(distribution));
    }

    private async loadDistributionDto(owner: WalletOwner, distributionId: string) {
        const distribuicoes = await this.treasuryService.listDistributions(owner, 50);

        const encontrada = distribuicoes.find((linha) => linha.id === distributionId);

        return encontrada ? this.toDistributionDto(encontrada) : null;
    }

    private toDistributionDto(distribution: {
        id: string;
        total: bigint;
        basis: string;
        status: string;
        note: string | null;
        requested_by: string | null;
        decided_by: string | null;
        decided_at: Date | null;
        created_at: Date;
        lines: MovementRow[];
    }) {
        return {
            id: distribution.id,
            total: distribution.total.toString(),
            basis: distribution.basis,
            status: distribution.status,
            note: distribution.note,
            requestedBy: distribution.requested_by,
            decidedBy: distribution.decided_by,
            decidedAt: distribution.decided_at?.toISOString() ?? null,
            createdAt: distribution.created_at.toISOString(),
            lines: distribution.lines.map((linha) => this.toMovementDto(linha)),
        };
    }

    private async propose(
        request: FastifyRequest<{ Body: ProposeMovementDto }>,
        reply: FastifyReply,
        owner: WalletOwner,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const movement = await this.treasuryService.proposeMovement(owner, {
            /**
             * O montante chega como texto e só aqui vira BigInt, para
             * nunca passar por um número de JavaScript pelo caminho.
             */
            amount: BigInt(request.body.amount),
            direction: request.body.direction as TransactionDirection,
            category: request.body.category as TransactionCategory,
            description: request.body.description,
            requestedBy: user.id,
        });

        await this.auditService.record({
            action: 'treasury.movement.proposed',
            entityType: 'Transaction',
            entityId: movement.id,
            actorId: user.id,
            after: {
                amount: movement.amount.toString(),
                direction: movement.direction,
                category: movement.category,
                description: movement.description,
            },
            ...AuditService.contextOf(request),
        });

        reply.code(201).send(this.toMovementDto(movement));
    }

    private async decide(
        request: FastifyRequest,
        reply: FastifyReply,
        owner: WalletOwner,
        decision: 'approve' | 'reject' | 'cancel',
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const { movementId } = request.params as { movementId: string };

        const movement =
            decision === 'approve'
                ? await this.treasuryService.approveMovement(owner, movementId, user.id)
                : decision === 'reject'
                    ? await this.treasuryService.rejectMovement(
                        owner,
                        movementId,
                        user.id,
                    )
                    : await this.treasuryService.cancelMovement(
                        owner,
                        movementId,
                        user.id,
                    );

        if (!movement) {
            reply.code(404).send();
            return;
        }

        /**
         * Mover dinheiro de uma comunidade é a ação que mais precisa de
         * rasto: fica quem decidiu, o quê, e quanto.
         */
        await this.auditService.record({
            action: `treasury.movement.${decision}d`,
            entityType: 'Transaction',
            entityId: movement.id,
            actorId: user.id,
            before: { status: 'pending' },
            after: {
                status: movement.status,
                amount: movement.amount.toString(),
                direction: movement.direction,
                requestedBy: movement.requested_by,
            },
            ...AuditService.contextOf(request),
        });

        reply.send(this.toMovementDto(movement));
    }

    private toMovementDto(movement: MovementRow) {
        return {
            id: movement.id,
            amount: movement.amount.toString(),
            direction: movement.direction,
            category: movement.category,
            status: movement.status,
            description: movement.description,
            requestedBy: movement.requested_by,
            decidedBy: movement.decided_by,
            decidedAt: movement.decided_at?.toISOString() ?? null,
            createdAt: movement.created_at.toISOString(),
        };
    }

    private async build(owner: WalletOwner, query: ListMovementsQueryDto) {
        const [balances, movements] = await Promise.all([
            this.treasuryService.getBalances(owner),
            this.treasuryService.listMovements(
                owner,
                query.limit,
                query.status as TransactionStatus | undefined,
            ),
        ]);

        /**
         * Os montantes são BigInt e saem como texto, para não perderem
         * precisão ao passar por JSON. É dinheiro: um cêntimo perdido
         * numa conversão é um cêntimo que ninguém consegue explicar.
         */
        return {
            balances: {
                settled: balances.settled.toString(),
                pendingIn: balances.pendingIn.toString(),
                pendingOut: balances.pendingOut.toString(),
                available: balances.available.toString(),
            },
            movements: movements.map((movement) => this.toRow(movement)),
        };
    }

    private toRow(movement: TreasuryMovement) {
        return {
            id: movement.id,
            amount: movement.amount.toString(),
            direction: movement.direction,
            category: movement.category,
            status: movement.status,
            description: movement.description,
            requestedBy: movement.requestedBy,
            decidedBy: movement.decidedBy,
            decidedAt: movement.decidedAt?.toISOString() ?? null,
            createdAt: movement.createdAt.toISOString(),
        };
    }
}
