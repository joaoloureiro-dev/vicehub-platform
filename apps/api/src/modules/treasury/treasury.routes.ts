import type { FastifyPluginAsync } from 'fastify';

import type { TreasuryController } from './controllers/treasury.controller.js';
import type {
    CrewTreasuryParamDto,
    ListMovementsQueryDto,
    ServerTreasuryParamDto,
} from './dto/treasury.dto.js';
import {
    crewTreasuryParamSchema,
    listMovementsQuerySchema,
    serverTreasuryParamSchema,
} from './schemas/treasury.schemas.js';

interface TreasuryRoutesOptions {
    controller: TreasuryController;
}

/**
 * Rotas da tesouraria.
 *
 * Nenhuma é pública. O saldo de uma comunidade e a lista do que gastou
 * são de quem lá dentro tem autorização para os ver, e o âmbito é lido do
 * parâmetro da rota — um cargo noutra crew não serve.
 */
const treasuryRoutes: FastifyPluginAsync<TreasuryRoutesOptions> = async (
    fastify,
    options,
) => {
    const { controller } = options;

    /**
     * A própria carteira não exige permissão nenhuma além de ter conta.
     */
    fastify.get<{ Querystring: ListMovementsQueryDto }>(
        '/me',
        {
            preHandler: [fastify.authenticate],
            schema: { querystring: listMovementsQuerySchema },
        },
        controller.getMine.bind(controller),
    );

    fastify.get<{
        Params: CrewTreasuryParamDto;
        Querystring: ListMovementsQueryDto;
    }>(
        '/crews/:crewId',
        {
            preHandler: [fastify.authenticate, fastify.authorize('treasury:read')],
            schema: {
                params: crewTreasuryParamSchema,
                querystring: listMovementsQuerySchema,
            },
        },
        controller.getCrew.bind(controller),
    );

    fastify.get<{
        Params: ServerTreasuryParamDto;
        Querystring: ListMovementsQueryDto;
    }>(
        '/servers/:serverId',
        {
            preHandler: [fastify.authenticate, fastify.authorize('treasury:read')],
            schema: {
                params: serverTreasuryParamSchema,
                querystring: listMovementsQuerySchema,
            },
        },
        controller.getServer.bind(controller),
    );
};

export default treasuryRoutes;
