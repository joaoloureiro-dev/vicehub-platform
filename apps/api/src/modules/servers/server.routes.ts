import type { FastifyPluginAsync } from 'fastify';

import type { UpdateAppearanceDto } from '../../shared/appearance.js';
import { updateAppearanceSchema } from '../../shared/appearance.js';
import type { ServerController } from './controllers/server.controller.js';
import type {
    CreateServerDto,
    ListServersQueryDto,
    ServerIdParamDto,
    ServerMemberParamDto,
    SetServerMemberRoleDto,
    UpdateServerDto,
} from './dto/server.dto.js';
import {
    createServerSchema,
    listServersQuerySchema,
    serverIdParamSchema,
    serverMemberParamSchema,
    setServerMemberRoleSchema,
    updateServerSchema,
} from './schemas/server.schemas.js';

interface ServerRoutesOptions {
    controller: ServerController;
}

/**
 * Rotas do módulo de servidores.
 *
 * As rotas de gestão exigem a permissão avaliada no âmbito do próprio
 * servidor: o guard lê o serverId dos parâmetros, pelo que um cargo
 * noutro servidor nunca autoriza uma operação neste.
 */
const serverRoutes: FastifyPluginAsync<ServerRoutesOptions> = async (
    fastify,
    options,
) => {
    const { controller } = options;

    /**
     * Criar um servidor só exige conta: qualquer utilizador o pode fazer,
     * e torna-se dono do que criou.
     */
    fastify.post<{ Body: CreateServerDto }>(
        '/',
        {
            preHandler: [fastify.authenticate],
            schema: { body: createServerSchema },
        },
        controller.create.bind(controller),
    );

    /**
     * O diretório é público e paginado.
     *
     * É por aqui que alguém encontra um servidor a que se candidatar sem
     * já saber o identificador dele.
     */
    fastify.get<{ Querystring: ListServersQueryDto }>(
        '/',
        { schema: { querystring: listServersQuerySchema } },
        controller.listDirectory.bind(controller),
    );

    /**
     * As candidaturas e adesões de quem faz o pedido.
     */
    fastify.get(
        '/me/memberships',
        { preHandler: [fastify.authenticate] },
        controller.listMyMemberships.bind(controller),
    );

    /**
     * Perfil e lista de membros são públicos, tal como nas crews.
     */
    fastify.get<{ Params: ServerIdParamDto }>(
        '/:serverId',
        { schema: { params: serverIdParamSchema } },
        controller.getProfile.bind(controller),
    );

    fastify.get<{ Params: ServerIdParamDto }>(
        '/:serverId/members',
        { schema: { params: serverIdParamSchema } },
        controller.listMembers.bind(controller),
    );

    fastify.patch<{ Params: ServerIdParamDto; Body: UpdateServerDto }>(
        '/:serverId',
        {
            preHandler: [fastify.authenticate, fastify.authorize('server:manage')],
            schema: { params: serverIdParamSchema, body: updateServerSchema },
        },
        controller.update.bind(controller),
    );

    /**
     * Personalização do servidor: banner e cor de destaque.
     *
     * Dois guards, porque são duas condições distintas: mandar no
     * servidor (server:manage) e o servidor ter plano ativo. O
     * requirePremium lê o serverId dos parâmetros, pelo que é o plano
     * *deste* servidor que conta — e não o de quem faz o pedido.
     */
    fastify.patch<{ Params: ServerIdParamDto; Body: UpdateAppearanceDto }>(
        '/:serverId/appearance',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('server:manage'),
                fastify.requirePremium('server'),
            ],
            schema: { params: serverIdParamSchema, body: updateAppearanceSchema },
        },
        controller.updateAppearance.bind(controller),
    );

    /**
     * Pedir entrada, retirar o pedido e sair dizem respeito ao próprio:
     * exigem conta, mas nenhuma permissão sobre o servidor.
     */
    fastify.post<{ Params: ServerIdParamDto }>(
        '/:serverId/join',
        {
            preHandler: [fastify.authenticate],
            schema: { params: serverIdParamSchema },
        },
        controller.requestToJoin.bind(controller),
    );

    fastify.delete<{ Params: ServerIdParamDto }>(
        '/:serverId/join',
        {
            preHandler: [fastify.authenticate],
            schema: { params: serverIdParamSchema },
        },
        controller.withdrawJoinRequest.bind(controller),
    );

    fastify.post<{ Params: ServerIdParamDto }>(
        '/:serverId/leave',
        {
            preHandler: [fastify.authenticate],
            schema: { params: serverIdParamSchema },
        },
        controller.leave.bind(controller),
    );

    /**
     * Responder a pedidos e gerir membros exigem server:manage_members no
     * âmbito deste servidor.
     */
    fastify.get<{ Params: ServerIdParamDto }>(
        '/:serverId/requests',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('server:manage_members'),
            ],
            schema: { params: serverIdParamSchema },
        },
        controller.listJoinRequests.bind(controller),
    );

    fastify.post<{ Params: ServerMemberParamDto }>(
        '/:serverId/requests/:userId/accept',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('server:manage_members'),
            ],
            schema: { params: serverMemberParamSchema },
        },
        controller.acceptRequest.bind(controller),
    );

    fastify.post<{ Params: ServerMemberParamDto }>(
        '/:serverId/requests/:userId/reject',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('server:manage_members'),
            ],
            schema: { params: serverMemberParamSchema },
        },
        controller.rejectRequest.bind(controller),
    );

    fastify.delete<{ Params: ServerMemberParamDto }>(
        '/:serverId/members/:userId',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('server:manage_members'),
            ],
            schema: { params: serverMemberParamSchema },
        },
        controller.removeMember.bind(controller),
    );

    /**
     * Alterar cargos mexe em quem manda no servidor, incluindo passar a
     * posse a outra pessoa. Exige server:manage, e não apenas a gestão de
     * membros, para que um moderador não se possa promover a dono.
     */
    fastify.put<{ Params: ServerMemberParamDto; Body: SetServerMemberRoleDto }>(
        '/:serverId/members/:userId/role',
        {
            preHandler: [fastify.authenticate, fastify.authorize('server:manage')],
            schema: {
                params: serverMemberParamSchema,
                body: setServerMemberRoleSchema,
            },
        },
        controller.setMemberRole.bind(controller),
    );
};

export default serverRoutes;
