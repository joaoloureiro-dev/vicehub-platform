import type { FastifyPluginAsync } from 'fastify';

import type { CrewController } from './controllers/crew.controller.js';
import type {
    CreateCrewDto,
    CrewIdParamDto,
    CrewMemberParamDto,
    SetMemberRoleDto,
    UpdateCrewDto,
} from './dto/crew.dto.js';
import {
    createCrewSchema,
    crewIdParamSchema,
    crewMemberParamSchema,
    setMemberRoleSchema,
    updateCrewSchema,
} from './schemas/crew.schemas.js';

interface CrewRoutesOptions {
    controller: CrewController;
}

/**
 * Rotas do módulo de crews.
 *
 * As rotas de gestão exigem a permissão avaliada no âmbito da própria
 * crew: o guard lê o crewId dos parâmetros, pelo que um cargo noutra
 * crew nunca autoriza uma operação nesta.
 */
const crewRoutes: FastifyPluginAsync<CrewRoutesOptions> = async (
    fastify,
    options,
) => {
    const { controller } = options;

    /**
     * Criar uma crew só exige conta: qualquer utilizador o pode fazer, e
     * torna-se líder da que criou.
     */
    fastify.post<{ Body: CreateCrewDto }>(
        '/',
        {
            preHandler: [fastify.authenticate],
            schema: { body: createCrewSchema },
        },
        controller.create.bind(controller),
    );

    /**
     * Perfil e lista de membros são públicos, tal como o perfil de
     * utilizador.
     */
    fastify.get<{ Params: CrewIdParamDto }>(
        '/:crewId',
        { schema: { params: crewIdParamSchema } },
        controller.getProfile.bind(controller),
    );

    fastify.get<{ Params: CrewIdParamDto }>(
        '/:crewId/members',
        { schema: { params: crewIdParamSchema } },
        controller.listMembers.bind(controller),
    );

    fastify.patch<{ Params: CrewIdParamDto; Body: UpdateCrewDto }>(
        '/:crewId',
        {
            preHandler: [fastify.authenticate, fastify.authorize('crew:manage')],
            schema: { params: crewIdParamSchema, body: updateCrewSchema },
        },
        controller.update.bind(controller),
    );

    /**
     * Pedir entrada e sair dizem respeito ao próprio: exigem conta, mas
     * nenhuma permissão sobre a crew.
     */
    fastify.post<{ Params: CrewIdParamDto }>(
        '/:crewId/join',
        {
            preHandler: [fastify.authenticate],
            schema: { params: crewIdParamSchema },
        },
        controller.requestToJoin.bind(controller),
    );

    fastify.post<{ Params: CrewIdParamDto }>(
        '/:crewId/leave',
        {
            preHandler: [fastify.authenticate],
            schema: { params: crewIdParamSchema },
        },
        controller.leave.bind(controller),
    );

    /**
     * Responder a pedidos e gerir membros exigem crew:manage_members no
     * âmbito desta crew.
     */
    fastify.get<{ Params: CrewIdParamDto }>(
        '/:crewId/requests',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('crew:manage_members'),
            ],
            schema: { params: crewIdParamSchema },
        },
        controller.listJoinRequests.bind(controller),
    );

    fastify.post<{ Params: CrewMemberParamDto }>(
        '/:crewId/requests/:userId/accept',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('crew:manage_members'),
            ],
            schema: { params: crewMemberParamSchema },
        },
        controller.acceptRequest.bind(controller),
    );

    fastify.post<{ Params: CrewMemberParamDto }>(
        '/:crewId/requests/:userId/reject',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('crew:manage_members'),
            ],
            schema: { params: crewMemberParamSchema },
        },
        controller.rejectRequest.bind(controller),
    );

    fastify.delete<{ Params: CrewMemberParamDto }>(
        '/:crewId/members/:userId',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('crew:manage_members'),
            ],
            schema: { params: crewMemberParamSchema },
        },
        controller.removeMember.bind(controller),
    );

    fastify.put<{ Params: CrewMemberParamDto; Body: SetMemberRoleDto }>(
        '/:crewId/members/:userId/role',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('crew:manage_members'),
            ],
            schema: { params: crewMemberParamSchema, body: setMemberRoleSchema },
        },
        controller.setMemberRole.bind(controller),
    );
};

export default crewRoutes;
