import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { AuditRepository } from '../audit/repositories/audit.repository.js';
import { AuditService } from '../audit/services/audit.service.js';
import { SubscriptionRepository } from '../subscriptions/repositories/subscription.repository.js';
import { SubscriptionService } from '../subscriptions/services/subscription.service.js';
import affiliationRoutes from './affiliation.routes.js';
import { AffiliationController } from './controllers/affiliation.controller.js';
import { AffiliationRepository } from './repositories/affiliation.repository.js';
import { AffiliationService } from './services/affiliation.service.js';

/**
 * Módulo das filiações entre crews e servidores.
 */
const affiliationModule: FastifyPluginAsync = async (fastify) => {
    const affiliationService = new AffiliationService(
        new AffiliationRepository(fastify.prisma),
        new SubscriptionService(new SubscriptionRepository(fastify.prisma)),
    );

    await fastify.register(affiliationRoutes, {
        controller: new AffiliationController(
            affiliationService,
            new AuditService(new AuditRepository(fastify.prisma)),
        ),
    });
};

export default fp(affiliationModule, {
    name: 'affiliation-module',
    dependencies: ['prisma-plugin', 'authenticate-plugin', 'authorize-plugin'],
});
