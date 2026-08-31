import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { RoleAssignmentRepository } from '../authorization/repositories/role-assignment.repository.js';
import { RoleAssignmentService } from '../authorization/services/role-assignment.service.js';
import { SubscriptionRepository } from '../subscriptions/repositories/subscription.repository.js';
import { SubscriptionService } from '../subscriptions/services/subscription.service.js';
import { CrewController } from './controllers/crew.controller.js';
import { CrewRepository } from './repositories/crew.repository.js';
import { CrewService } from './services/crew.service.js';
import crewRoutes from './crew.routes.js';

/**
 * Módulo responsável pelas crews.
 */
const crewModule: FastifyPluginAsync = async (fastify) => {
    const crewService = new CrewService(
        new CrewRepository(fastify.prisma),
        new RoleAssignmentService(new RoleAssignmentRepository(fastify.prisma)),
        new SubscriptionService(new SubscriptionRepository(fastify.prisma)),
    );

    await fastify.register(crewRoutes, {
        prefix: '/api/v1/crews',
        controller: new CrewController(crewService),
    });
};

export default fp(crewModule, {
    name: 'crew-module',
    dependencies: ['prisma-plugin', 'authenticate-plugin', 'authorize-plugin'],
});
