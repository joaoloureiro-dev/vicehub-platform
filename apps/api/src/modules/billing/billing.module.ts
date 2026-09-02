import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { AuditRepository } from '../audit/repositories/audit.repository.js';
import { AuditService } from '../audit/services/audit.service.js';
import billingRoutes from './billing.routes.js';
import { BillingController } from './controllers/billing.controller.js';
import { BillingRepository } from './repositories/billing.repository.js';
import { BillingService } from './services/billing.service.js';
import { createStripeGateway } from './services/stripe.gateway.js';

/**
 * Módulo da cobrança.
 *
 * O gateway é nulo quando não há configuração de Stripe. A plataforma
 * arranca na mesma e tudo o resto funciona — incluindo a concessão
 * manual de planos e o vitalício; o que não existe é a compra pelo
 * próprio, e as rotas dizem-no com 503 em vez de rebentar.
 */
const billingModule: FastifyPluginAsync = async (fastify) => {
    const billingService = new BillingService(
        new BillingRepository(fastify.prisma),
        createStripeGateway(),
    );

    await fastify.register(billingRoutes, {
        prefix: '/api/v1/billing',
        controller: new BillingController(
            billingService,
            new AuditService(new AuditRepository(fastify.prisma)),
        ),
    });
};

export default fp(billingModule, {
    name: 'billing-module',
    dependencies: ['prisma-plugin', 'authenticate-plugin'],
});
