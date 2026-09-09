import type { FastifyPluginAsync } from 'fastify';

import type { FriendController } from './controllers/friend.controller.js';
import type { FriendParamDto } from './dto/friend.dto.js';
import { friendParamSchema } from './schemas/friend.schemas.js';

interface FriendRoutesOptions {
    controller: FriendController;
}

/**
 * Rotas das amizades.
 *
 * Nenhuma exige permissão de âmbito, e é de propósito: uma amizade é
 * entre duas pessoas e não pertence a nenhuma crew nem a nenhum
 * servidor. O que a autoriza é ser-se uma das duas — e isso o serviço
 * verifica pelo par, não por um cargo.
 */
const friendRoutes: FastifyPluginAsync<FriendRoutesOptions> = async (
    fastify,
    options,
) => {
    const { controller } = options;

    /**
     * As estáticas antes da paramétrica: sem isto, um pedido a
     * /friends/requests seria lido como um utilizador chamado
     * "requests" — e responderia 400 em vez de a lista.
     */
    fastify.get(
        '/',
        { preHandler: [fastify.authenticate] },
        controller.list.bind(controller),
    );

    fastify.get(
        '/requests',
        { preHandler: [fastify.authenticate] },
        controller.listRequests.bind(controller),
    );

    fastify.post<{ Params: FriendParamDto }>(
        '/:userId',
        {
            preHandler: [fastify.authenticate],
            schema: { params: friendParamSchema },
        },
        controller.request.bind(controller),
    );

    fastify.post<{ Params: FriendParamDto }>(
        '/:userId/accept',
        {
            preHandler: [fastify.authenticate],
            schema: { params: friendParamSchema },
        },
        controller.accept.bind(controller),
    );

    /**
     * A mesma porta para recusar, retirar e desfazer: do lado de quem
     * carrega são a mesma coisa — já não quero isto.
     */
    fastify.delete<{ Params: FriendParamDto }>(
        '/:userId',
        {
            preHandler: [fastify.authenticate],
            schema: { params: friendParamSchema },
        },
        controller.remove.bind(controller),
    );
};

export default friendRoutes;
