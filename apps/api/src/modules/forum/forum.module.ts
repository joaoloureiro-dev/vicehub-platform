import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { AuthorizationRepository } from '../authorization/repositories/authorization.repository.js';
import { AuthorizationService } from '../authorization/services/authorization.service.js';
import { ForumController } from './controllers/forum.controller.js';
import { ForumRepository } from './repositories/forum.repository.js';
import { ForumService } from './services/forum.service.js';
import forumRoutes from './forum.routes.js';

/**
 * Módulo do fórum.
 *
 * Leva o serviço de autorização porque precisa de fazer uma pergunta
 * **branda**: quem está a pedir consegue moderar? O `authorize` responde
 * a isso recusando o pedido, e aqui a resposta não pode ser uma recusa —
 * quem não modera continua a poder retirar o que escreveu.
 */
const forumModule: FastifyPluginAsync = async (fastify) => {
    await fastify.register(forumRoutes, {
        prefix: '/api/v1/forum',
        controller: new ForumController(
            new ForumService(new ForumRepository(fastify.prisma)),
            new AuthorizationService(
                new AuthorizationRepository(fastify.prisma),
            ),
        ),
    });
};

export default fp(forumModule, {
    name: 'forum-module',
    dependencies: ['prisma-plugin', 'authenticate-plugin', 'authorize-plugin'],
});
