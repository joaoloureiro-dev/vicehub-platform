import type { FastifyReply, FastifyRequest } from 'fastify';

import { AuditService } from '../../audit/services/audit.service.js';
import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import type { OpenPortalDto, StartCheckoutDto } from '../dto/billing.dto.js';
import { BillingError } from '../errors/billing.errors.js';
import type { BillingService } from '../services/billing.service.js';

export class BillingController {
    constructor(
        private readonly billingService: BillingService,
        private readonly auditService: AuditService,
    ) { }

    /**
     * GET /billing/plans
     *
     * Pública: uma lista de preços é para ser vista antes de haver conta.
     */
    listPlans(_request: FastifyRequest, reply: FastifyReply): void {
        reply.send(this.billingService.listPurchasablePlans());
    }

    /**
     * POST /billing/checkout
     */
    async startCheckout(
        request: FastifyRequest<{ Body: StartCheckoutDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const sessao = await this.billingService.startCheckout({
            ownerKind: request.body.ownerKind,
            ownerId: request.body.ownerId,
            buyerId: user.id,
            plan: request.body.plan,
        });

        await this.auditService.record({
            action: 'billing.checkout.started',
            entityType: 'Subscription',
            entityId: request.body.ownerId,
            actorId: user.id,
            after: {
                ownerKind: request.body.ownerKind,
                ownerId: request.body.ownerId,
                /**
                 * O escalão fica no registo: quando alguém perguntar
                 * porque é que um servidor tem o plano que tem, a
                 * resposta é o que foi pedido aqui.
                 */
                plan: request.body.plan,
            },
            ...AuditService.contextOf(request),
        });

        reply.send(sessao);
    }

    /**
     * POST /billing/portal
     *
     * Devolve para onde encaminhar quem quer cancelar, trocar o cartão
     * ou tirar uma fatura.
     */
    async openPortal(
        request: FastifyRequest<{ Body: OpenPortalDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const sessao = await this.billingService.openPortal({
            ownerKind: request.body.ownerKind,
            ownerId: request.body.ownerId,
            actorId: user.id,
        });

        /**
         * Fica no registo quem abriu o painel, e não o que lá fez: o que
         * lá acontece chega por webhook e é gravado quando chegar. Sem
         * esta linha, um plano cancelado aparecia sem ninguém por perto
         * — e saber quem foi lá é metade da resposta a "porque é que
         * isto deixou de estar pago".
         */
        await this.auditService.record({
            action: 'billing.portal.opened',
            entityType: 'Subscription',
            entityId: request.body.ownerId,
            actorId: user.id,
            after: {
                ownerKind: request.body.ownerKind,
                ownerId: request.body.ownerId,
            },
            ...AuditService.contextOf(request),
        });

        reply.send(sessao);
    }

    /**
     * POST /billing/webhook
     *
     * Pública por natureza — quem a chama é o Stripe, que não tem conta
     * nesta plataforma. O que a protege é a assinatura, verificada antes
     * de qualquer leitura do conteúdo.
     */
    async handleWebhook(
        request: FastifyRequest,
        reply: FastifyReply,
    ): Promise<void> {
        const signature = request.headers['stripe-signature'];

        if (typeof signature !== 'string') {
            throw new BillingError(
                'INVALID_WEBHOOK_SIGNATURE',
                'O pedido chegou sem assinatura.',
            );
        }

        /**
         * O corpo em bruto, tal como chegou: a assinatura cobre os bytes,
         * e qualquer releitura do JSON invalidaria a verificação.
         */
        const evento = this.billingService.verifyEvent(
            request.body as Buffer,
            signature,
        );

        const resultado = await this.billingService.applyEvent(evento);

        /**
         * Responde-se sempre 200 a um evento com assinatura válida,
         * mesmo quando é repetido ou ignorado. Devolver um erro faria o
         * Stripe reenviá-lo indefinidamente por causa de uma coisa que
         * já está tratada.
         */
        reply.send({ received: true, outcome: resultado });
    }
}
