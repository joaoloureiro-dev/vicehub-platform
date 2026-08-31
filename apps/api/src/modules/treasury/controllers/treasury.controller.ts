import type { FastifyReply, FastifyRequest } from 'fastify';

import type { TransactionStatus } from '@vicehub/database';

import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import type {
    CrewTreasuryParamDto,
    ListMovementsQueryDto,
    ServerTreasuryParamDto,
} from '../dto/treasury.dto.js';
import type { TreasuryService } from '../services/treasury.service.js';
import type { TreasuryMovement, WalletOwner } from '../types/treasury.types.js';

export class TreasuryController {
    constructor(private readonly treasuryService: TreasuryService) { }

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
