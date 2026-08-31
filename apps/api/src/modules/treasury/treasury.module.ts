import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { TreasuryController } from './controllers/treasury.controller.js';
import { TreasuryRepository } from './repositories/treasury.repository.js';
import { TreasuryService } from './services/treasury.service.js';
import treasuryRoutes from './treasury.routes.js';

/**
 * Módulo responsável pela tesouraria.
 */
const treasuryModule: FastifyPluginAsync = async (fastify) => {
    const treasuryService = new TreasuryService(
        new TreasuryRepository(fastify.prisma),
    );

    await fastify.register(treasuryRoutes, {
        prefix: '/api/v1/treasury',
        controller: new TreasuryController(treasuryService),
    });
};

export default fp(treasuryModule, {
    name: 'treasury-module',
    dependencies: ['prisma-plugin', 'authenticate-plugin', 'authorize-plugin'],
});
