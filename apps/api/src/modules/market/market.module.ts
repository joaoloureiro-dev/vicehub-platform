import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { MarketController } from './controllers/market.controller.js';
import { MarketRepository } from './repositories/market.repository.js';
import { MarketService } from './services/market.service.js';
import marketRoutes from './market.routes.js';

/**
 * Módulo do mercado.
 *
 * Sem o serviço de autorização, ao contrário do fórum: aqui não há
 * nenhuma pergunta branda a fazer. Um anúncio é de quem o escreveu, e
 * de mais ninguém — não há moderador que lhe mexa enquanto não houver
 * por onde alguém se queixar dele.
 */
const marketModule: FastifyPluginAsync = async (fastify) => {
    await fastify.register(marketRoutes, {
        prefix: '/api/v1/market',
        controller: new MarketController(
            new MarketService(new MarketRepository(fastify.prisma)),
        ),
    });
};

export default fp(marketModule, {
    name: 'market-module',
    dependencies: ['prisma-plugin', 'authenticate-plugin', 'authorize-plugin'],
});
