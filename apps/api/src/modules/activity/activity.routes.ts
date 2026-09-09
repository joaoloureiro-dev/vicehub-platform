import type { FastifyPluginAsync } from 'fastify';

import type { ActivityController } from './controllers/activity.controller.js';

interface ActivityRoutesOptions {
    controller: ActivityController;
}

/**
 * O feed é sempre o de quem pergunta.
 *
 * Não há rota para ver o feed de outra pessoa, e é de propósito: o feed
 * é feito do que **eu** posso ver, e um feed de outra pessoa seria uma
 * lista das coisas a que ela tem acesso — dita a quem não tem.
 */
const activityRoutes: FastifyPluginAsync<ActivityRoutesOptions> = async (
    fastify,
    options,
) => {
    fastify.get(
        '/',
        { preHandler: [fastify.authenticate] },
        options.controller.list.bind(options.controller),
    );
};

export default activityRoutes;
