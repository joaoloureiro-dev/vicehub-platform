import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { SubscriptionController } from './controllers/subscription.controller.js';
import { SubscriptionRepository } from './repositories/subscription.repository.js';
import { SubscriptionService } from './services/subscription.service.js';
import subscriptionRoutes from './subscription.routes.js';

/**
 * Módulo responsável pelas subscrições.
 */
const subscriptionModule: FastifyPluginAsync = async (fastify) => {
    const subscriptionService = new SubscriptionService(
        new SubscriptionRepository(fastify.prisma),
    );

    await fastify.register(subscriptionRoutes, {
        prefix: '/api/v1/subscriptions',
        controller: new SubscriptionController(subscriptionService),
    });
};

export default fp(subscriptionModule, {
    name: 'subscription-module',
    dependencies: ['prisma-plugin', 'authenticate-plugin', 'authorize-plugin'],
});
