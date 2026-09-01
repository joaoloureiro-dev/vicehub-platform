import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { AuditRepository } from '../audit/repositories/audit.repository.js';
import { AuditService } from '../audit/services/audit.service.js';
import { EventController } from './controllers/event.controller.js';
import { EventRepository } from './repositories/event.repository.js';
import { EventService } from './services/event.service.js';
import eventRoutes from './event.routes.js';

/**
 * Módulo responsável pelos eventos.
 */
const eventModule: FastifyPluginAsync = async (fastify) => {
    await fastify.register(eventRoutes, {
        prefix: '/api/v1/events',
        controller: new EventController(
            new EventService(new EventRepository(fastify.prisma)),
            new AuditService(new AuditRepository(fastify.prisma)),
        ),
    });
};

export default fp(eventModule, {
    name: 'event-module',
    dependencies: ['prisma-plugin', 'authenticate-plugin', 'authorize-plugin'],
});
