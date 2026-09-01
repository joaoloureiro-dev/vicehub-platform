import type { FastifyReply, FastifyRequest } from 'fastify';

import type {
    TransactionCategory,
    TransactionDirection,
    TransactionStatus,
} from '@vicehub/database';

import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import { AuditService } from '../../audit/services/audit.service.js';
import type {
    CrewMovementParamDto,
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
