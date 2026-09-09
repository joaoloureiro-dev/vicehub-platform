import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import activityRoutes from './activity.routes.js';
import { ActivityController } from './controllers/activity.controller.js';
import { ActivityRepository } from './repositories/activity.repository.js';
import { ActivityService } from './services/activity.service.js';

/**
 * Módulo do feed de atividade.
 */
const activityModule: FastifyPluginAsync = async (fastify) => {
    const activityService = new ActivityService(
        new ActivityRepository(fastify.prisma),
    );

    await fastify.register(activityRoutes, {
        prefix: '/api/v1/activity',
        controller: new ActivityController(activityService),
    });
};

export default fp(activityModule, {
    name: 'activity-module',
    dependencies: ['prisma-plugin', 'authenticate-plugin'],
});
