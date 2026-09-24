import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { MarketController } from './controllers/market.controller.js';
import { MarketRepository } from './repositories/market.repository.js';
import { MarketService } from './services/market.service.js';
import marketRoutes from './market.routes.js';
import { ConversationController } from './controllers/conversation.controller.js';
import { ConversationRepository } from './repositories/conversation.repository.js';
import { ConversationService } from './services/conversation.service.js';
import { AuthorizationRepository } from '../authorization/repositories/authorization.repository.js';
import { AuthorizationService } from '../authorization/services/authorization.service.js';
import { ModerationController } from '../moderation/controllers/moderation.controller.js';
import { construirReportService } from '../moderation/moderation.module.js';

/**
 * Módulo do mercado.
 *
 * Leva o serviço de autorização pela mesma razão do fórum: há uma
 * pergunta **branda** a fazer — quem está a pedir modera o mercado? O
 * `authorize` responde a isso recusando o pedido, e aqui a resposta não
 * pode ser uma recusa, porque quem não modera continua a poder retirar
 * o que anunciou.
 *
 * E leva o serviço das denúncias, que é de outro módulo: o botão vive
 * ao lado do anúncio, a fila é uma só para as duas superfícies.
 */
const marketModule: FastifyPluginAsync = async (fastify) => {
    const reportService = construirReportService(fastify.prisma);
    const autorizacao = new AuthorizationService(
        new AuthorizationRepository(fastify.prisma),
    );

    await fastify.register(marketRoutes, {
        prefix: '/api/v1/market',
        controller: new MarketController(
            new MarketService(new MarketRepository(fastify.prisma)),
            autorizacao,
            reportService,
            new ModerationController(reportService),
        ),
        conversations: new ConversationController(
            new ConversationService(
                new ConversationRepository(fastify.prisma),
            ),
            autorizacao,
            reportService,
            new ModerationController(reportService),
        ),
    });
};

export default fp(marketModule, {
    name: 'market-module',
    dependencies: ['prisma-plugin', 'authenticate-plugin', 'authorize-plugin'],
});
