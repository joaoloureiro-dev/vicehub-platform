import type { FastifyPluginAsync } from 'fastify';

import type { TreasuryController } from './controllers/treasury.controller.js';
import type {
    CrewDistributionParamDto,
    CrewMovementParamDto,
    ProposeDistributionDto,
    CrewTreasuryParamDto,
    ListMovementsQueryDto,
    ProposeMovementDto,
    ServerMovementParamDto,
    ServerTreasuryParamDto,
} from './dto/treasury.dto.js';
import {
    crewDistributionParamSchema,
    crewMovementParamSchema,
    proposeDistributionSchema,
    crewTreasuryParamSchema,
    listMovementsQuerySchema,
    proposeMovementSchema,
    serverMovementParamSchema,
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
    /**
     * Propor um movimento exige treasury:transfer no âmbito desta
     * tesouraria. Nasce pendente: propor não move dinheiro nenhum.
     */
    fastify.post<{ Params: CrewTreasuryParamDto; Body: ProposeMovementDto }>(
        '/crews/:crewId/movements',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('treasury:transfer'),
            ],
            schema: {
                params: crewTreasuryParamSchema,
                body: proposeMovementSchema,
            },
        },
        controller.proposeCrewMovement.bind(controller),
    );

    fastify.post<{ Params: ServerTreasuryParamDto; Body: ProposeMovementDto }>(
        '/servers/:serverId/movements',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('treasury:transfer'),
            ],
            schema: {
                params: serverTreasuryParamSchema,
                body: proposeMovementSchema,
            },
        },
        controller.proposeServerMovement.bind(controller),
    );

    /**
     * Decidir é que move o dinheiro, e exige treasury:approve.
     *
     * O identificador da tesouraria está no caminho porque é dele que o
     * guard tira o âmbito. O serviço confirma depois que o movimento
     * pertence mesmo a esta tesouraria: sem essa confirmação, quem manda
     * numa crew aprovaria movimentos de outra.
     */
    fastify.post<{ Params: CrewMovementParamDto }>(
        '/crews/:crewId/movements/:movementId/approve',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('treasury:approve'),
            ],
            schema: { params: crewMovementParamSchema },
        },
        controller.approveCrewMovement.bind(controller),
    );

    fastify.post<{ Params: CrewMovementParamDto }>(
        '/crews/:crewId/movements/:movementId/reject',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('treasury:approve'),
            ],
            schema: { params: crewMovementParamSchema },
        },
        controller.rejectCrewMovement.bind(controller),
    );

    fastify.post<{ Params: ServerMovementParamDto }>(
        '/servers/:serverId/movements/:movementId/approve',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('treasury:approve'),
            ],
            schema: { params: serverMovementParamSchema },
        },
        controller.approveServerMovement.bind(controller),
    );

    fastify.post<{ Params: ServerMovementParamDto }>(
        '/servers/:serverId/movements/:movementId/reject',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('treasury:approve'),
            ],
            schema: { params: serverMovementParamSchema },
        },
        controller.rejectServerMovement.bind(controller),
    );

    /**
     * Retirar a própria proposta exige apenas quem a propôs, e por isso
     * basta treasury:transfer. O serviço confirma a autoria.
     */
    fastify.delete<{ Params: CrewMovementParamDto }>(
        '/crews/:crewId/movements/:movementId',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('treasury:transfer'),
            ],
            schema: { params: crewMovementParamSchema },
        },
        controller.cancelCrewMovement.bind(controller),
    );

    fastify.delete<{ Params: ServerMovementParamDto }>(
        '/servers/:serverId/movements/:movementId',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('treasury:transfer'),
            ],
            schema: { params: serverMovementParamSchema },
        },
        controller.cancelServerMovement.bind(controller),
    );
    /**
     * Divisões de ganhos.
     *
     * Propor uma divisão é propor uma despesa da tesouraria, e por isso
     * basta treasury:transfer. Aprovar paga a toda a gente de uma vez e
     * exige treasury:approve — que é o mesmo nível que aprova qualquer
     * outra saída.
     */
    fastify.post<{ Params: CrewTreasuryParamDto; Body: ProposeDistributionDto }>(
        '/crews/:crewId/distributions',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('treasury:transfer'),
            ],
            schema: {
                params: crewTreasuryParamSchema,
                body: proposeDistributionSchema,
            },
        },
        controller.proposeCrewDistribution.bind(controller),
    );

    fastify.get<{
        Params: CrewTreasuryParamDto;
        Querystring: ListMovementsQueryDto;
    }>(
        '/crews/:crewId/distributions',
        {
            preHandler: [fastify.authenticate, fastify.authorize('treasury:read')],
            schema: {
                params: crewTreasuryParamSchema,
                querystring: listMovementsQuerySchema,
            },
        },
        controller.listCrewDistributions.bind(controller),
    );

    fastify.post<{ Params: CrewDistributionParamDto }>(
        '/crews/:crewId/distributions/:distributionId/approve',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('treasury:approve'),
            ],
            schema: { params: crewDistributionParamSchema },
        },
        controller.approveCrewDistribution.bind(controller),
    );

    fastify.post<{ Params: CrewDistributionParamDto }>(
        '/crews/:crewId/distributions/:distributionId/reject',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('treasury:approve'),
            ],
            schema: { params: crewDistributionParamSchema },
        },
        controller.rejectCrewDistribution.bind(controller),
    );
};

export default treasuryRoutes;
