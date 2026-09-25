import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { NotificationController } from './controllers/notification.controller.js';
import { NotificationRepository } from './repositories/notification.repository.js';
import { NotificationService } from './services/notification.service.js';
import notificationRoutes from './notification.routes.js';

/**
 * Módulo dos avisos.
 *
 * Só serve a caixa. **Quem cria um aviso é quem causa o acontecimento**
 * — o mercado, o fórum — e cria-o dentro da própria transação, com o
 * ajudante estático do repositório. Um serviço a criar avisos de fora
 * dessas transações era um aviso que se perde quando a escrita a que
 * ele pertence falha.
 */
const notificationModule: FastifyPluginAsync = async (fastify) => {
    await fastify.register(notificationRoutes, {
        prefix: '/api/v1/notifications',
        controller: new NotificationController(
            new NotificationService(
                new NotificationRepository(fastify.prisma),
            ),
        ),
    });
};

export default fp(notificationModule, {
    name: 'notification-module',
    dependencies: ['prisma-plugin', 'authenticate-plugin'],
});
