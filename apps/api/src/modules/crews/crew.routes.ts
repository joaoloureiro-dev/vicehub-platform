import type { FastifyPluginAsync } from 'fastify';

import type { CrewController } from './controllers/crew.controller.js';
import type {
    CreateCrewDto,
    CrewIdParamDto,
    ListCrewsQueryDto,
    CrewMemberParamDto,
    SetMemberRoleDto,
    UpdateCrewDto,
} from './dto/crew.dto.js';
import {
    createCrewSchema,
    crewIdParamSchema,
    listCrewsQuerySchema,
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
     * O diretório é público e paginado.
     *
     * É por aqui que alguém encontra uma crew a que se candidatar sem
     * já saber o identificador dela.
     */
    fastify.get<{ Querystring: ListCrewsQueryDto }>(
        '/',
        { schema: { querystring: listCrewsQuerySchema } },
        controller.listDirectory.bind(controller),
    );

    /**
     * As candidaturas e adesões de quem faz o pedido.
     *
     * O segmento é estático, pelo que nunca colide com /:crewId — que só
     * aceita um uuid.
     */
    fastify.get(
        '/me/memberships',
        { preHandler: [fastify.authenticate] },
        controller.listMyMemberships.bind(controller),
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
     * Pedir entrada, retirar o pedido e sair dizem respeito ao próprio:
     * exigem conta, mas nenhuma permissão sobre a crew.
     */
    fastify.post<{ Params: CrewIdParamDto }>(
        '/:crewId/join',
        {
            preHandler: [fastify.authenticate],
            schema: { params: crewIdParamSchema },
        },
        controller.requestToJoin.bind(controller),
    );

    fastify.delete<{ Params: CrewIdParamDto }>(
        '/:crewId/join',
        {
            preHandler: [fastify.authenticate],
            schema: { params: crewIdParamSchema },
        },
        controller.withdrawJoinRequest.bind(controller),
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

    /**
     * Alterar cargos mexe em quem manda na crew, incluindo passar a
     * liderança a outra pessoa. Exige crew:manage, e não apenas a gestão
     * de membros: com crew:manage_members um oficial podia promover um
     * cúmplice a líder e tomar a crew a quem a fundou.
     */
    fastify.put<{ Params: CrewMemberParamDto; Body: SetMemberRoleDto }>(
        '/:crewId/members/:userId/role',
        {
            preHandler: [fastify.authenticate, fastify.authorize('crew:manage')],
            schema: { params: crewMemberParamSchema, body: setMemberRoleSchema },
        },
        controller.setMemberRole.bind(controller),
    );
};

export default crewRoutes;
