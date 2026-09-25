import type { FastifyPluginAsync } from 'fastify';

import type { NotificationController } from './controllers/notification.controller.js';
import {
    listNotificationsQuerySchema,
    notificationIdParamSchema,
    type ListNotificationsQueryDto,
    type NotificationIdParamDto,
} from './schemas/notification.schemas.js';

interface NotificationRoutesOptions {
    controller: NotificationController;
}

/**
 * A caixa de avisos.
 *
 * **Nada disto é público, e nada disto pede uma permissão.** Os avisos
 * de uma pessoa são dela por definição: a rota não recebe de quem são,
 * lê-os da sessão. Uma permissão aqui era uma maneira de alguém ficar
 * sem acesso à sua própria caixa.
 */
const notificationRoutes: FastifyPluginAsync<
    NotificationRoutesOptions
> = async (fastify, { controller }) => {
    fastify.get<{ Querystring: ListNotificationsQueryDto }>(
        '/',
        {
            preHandler: [fastify.authenticate],
            schema: { querystring: listNotificationsQuerySchema },
        },
        controller.list.bind(controller),
    );

    fastify.get(
        '/unread',
        { preHandler: [fastify.authenticate] },
        controller.unread.bind(controller),
    );

    fastify.post(
        '/read',
        { preHandler: [fastify.authenticate] },
        controller.readAll.bind(controller),
    );

    fastify.post<{ Params: NotificationIdParamDto }>(
        '/:notificationId/read',
        {
            preHandler: [fastify.authenticate],
            schema: { params: notificationIdParamSchema },
        },
        controller.read.bind(controller),
    );
};

export default notificationRoutes;
