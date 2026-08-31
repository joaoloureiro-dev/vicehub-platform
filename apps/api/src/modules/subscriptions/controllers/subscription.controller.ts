import type { FastifyReply, FastifyRequest } from 'fastify';

import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import { AuditService } from '../../audit/services/audit.service.js';
import type {
    CrewScopeParamDto,
    GrantSubscriptionDto,
    ServerScopeParamDto,
    SubscriptionIdParamDto,
} from '../dto/subscription.dto.js';
import type { SubscriptionService } from '../services/subscription.service.js';
import type { SubscriptionOwner } from '../types/subscription.types.js';

/**
 * Linha de subscrição tal como sai na resposta.
 *
 * Só os campos que interessam a quem consulta: os identificadores do
 * provedor de pagamento ficam de fora.
 */
interface SubscriptionRow {
    id: string;
    plan: string;
    status: string;
    provider: string;
    price_cents: number;
    currency: string;
    current_period_start: Date;
    current_period_end: Date;
    cancel_at_period_end: boolean;
}

export class SubscriptionController {
    constructor(
        private readonly subscriptionService: SubscriptionService,
        private readonly auditService: AuditService,
    ) { }

    async grant(
        request: FastifyRequest<{ Body: GrantSubscriptionDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const subscription = await this.subscriptionService.grant({
            ...request.body,
            grantedBy: user.id,
        });

        /**
         * Conceder um plano é dar acesso pago sem pagamento. Fica no rasto
         * de auditoria com quem o fez, a quem, e por que período.
         */
        await this.auditService.record({
            action: 'subscription.granted',
            entityType: 'Subscription',
            entityId: subscription.id,
            actorId: user.id,
            after: {
                ownerKind: request.body.ownerKind,
                ownerId: request.body.ownerId,
                priceCents: subscription.price_cents,
                currency: subscription.currency,
                periodStart: subscription.current_period_start.toISOString(),
                periodEnd: subscription.current_period_end.toISOString(),
            },
            ...AuditService.contextOf(request),
        });

        reply.code(201).send(this.toRow(subscription));
    }

    async cancel(
        request: FastifyRequest<{ Params: SubscriptionIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const subscription = await this.subscriptionService.cancelAtPeriodEnd(
            request.params.subscriptionId,
            user.id,
        );

        await this.auditService.record({
            action: 'subscription.canceled',
            entityType: 'Subscription',
            entityId: subscription.id,
            actorId: user.id,
            before: { cancelAtPeriodEnd: false },
            after: {
                cancelAtPeriodEnd: true,
                periodEnd: subscription.current_period_end.toISOString(),
            },
            ...AuditService.contextOf(request),
        });

        reply.send(this.toRow(subscription));
    }

    async getMine(request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const { user } = requireAuthContext(request);

        reply.send(await this.buildSummary({ userId: user.id }));
    }

    async getCrew(
        request: FastifyRequest<{ Params: CrewScopeParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        reply.send(await this.buildSummary({ crewId: request.params.crewId }));
    }

    async getServer(
        request: FastifyRequest<{ Params: ServerScopeParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        reply.send(await this.buildSummary({ serverId: request.params.serverId }));
    }

    /**
     * Direito de acesso em vigor, com o histórico de períodos.
     */
    private async buildSummary(owner: SubscriptionOwner) {
        const [entitlement, history] = await Promise.all([
            this.subscriptionService.getEntitlement(owner),
            this.subscriptionService.listHistory(owner),
        ]);

        return {
            isPremium: entitlement.isPremium,
            activeUntil: this.toIso(entitlement.activeUntil),
            history: history.map((row) => this.toRow(row)),
        };
    }

    private toRow(subscription: SubscriptionRow) {
        return {
            id: subscription.id,
            plan: subscription.plan,
            status: subscription.status,
            provider: subscription.provider,
            priceCents: subscription.price_cents,
            currency: subscription.currency,
            currentPeriodStart: subscription.current_period_start.toISOString(),
            currentPeriodEnd: subscription.current_period_end.toISOString(),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
        };
    }

    private toIso(value: Date | null): string | null {
        return value === null ? null : value.toISOString();
    }
}