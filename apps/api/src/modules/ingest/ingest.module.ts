import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { IngestController } from './controllers/ingest.controller.js';
import ingestRoutes from './ingest.routes.js';
import { IngestRepository } from './repositories/ingest.repository.js';
import { ApiKeyService } from './services/api-key.service.js';
import { IngestService } from './services/ingest.service.js';

/**
 * Módulo da ingestão: as chaves dos servidores e o que eles reportam.
 */
const ingestModule: FastifyPluginAsync = async (fastify) => {
    const ingestService = new IngestService(
        new IngestRepository(fastify.prisma),
        new ApiKeyService(),
    );

    await fastify.register(ingestRoutes, {
        controller: new IngestController(ingestService),
    });
};

export default fp(ingestModule, {
    name: 'ingest-module',
    dependencies: [
        'prisma-plugin',
        'authenticate-plugin',
        'authorize-plugin',
        'authenticate-server-plugin',
    ],
});
