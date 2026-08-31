import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { RoleAssignmentRepository } from '../authorization/repositories/role-assignment.repository.js';
import { RoleAssignmentService } from '../authorization/services/role-assignment.service.js';
import { SubscriptionRepository } from '../subscriptions/repositories/subscription.repository.js';
import { SubscriptionService } from '../subscriptions/services/subscription.service.js';
import { ServerController } from './controllers/server.controller.js';
import { ServerRepository } from './repositories/server.repository.js';
import { ServerService } from './services/server.service.js';
import serverRoutes from './server.routes.js';

/**
 * Módulo responsável pelos servidores.
 */
const serverModule: FastifyPluginAsync = async (fastify) => {
    const serverService = new ServerService(
        new ServerRepository(fastify.prisma),
        new RoleAssignmentService(new RoleAssignmentRepository(fastify.prisma)),
        new SubscriptionService(new SubscriptionRepository(fastify.prisma)),
    );

    await fastify.register(serverRoutes, {
        prefix: '/api/v1/servers',
        controller: new ServerController(serverService),
    });
};

export default fp(serverModule, {
    name: 'server-module',
    dependencies: ['prisma-plugin', 'authenticate-plugin', 'authorize-plugin'],
});
