import type { FastifyPluginAsync } from 'fastify';

import type { AffiliationController } from './controllers/affiliation.controller.js';
import type {
    AffiliationParamDto,
    CrewIdParamDto,
    RequestAffiliationDto,
    ServerIdParamDto,
} from './dto/affiliation.dto.js';
import {
    affiliationParamSchema,
    crewIdParamSchema,
    requestAffiliationSchema,
    serverIdParamSchema,
} from './schemas/affiliation.schemas.js';

interface AffiliationRoutesOptions {
    controller: AffiliationController;
}

/**
 * Rotas das filiações entre crews e servidores.
 *
 * Vivem num módulo próprio, e não dentro do de crews ou do de
 * servidores, porque pertencem aos dois: metade das rotas está debaixo
 * de /crews e a outra metade debaixo de /servers, e pô-las num dos lados
 * faria esse módulo saber do outro sem precisar.
 *
 * O guard lê o âmbito dos parâmetros da rota, por convenção da
 * plataforma. Nas rotas do servidor há um crewId nos parâmetros além do
 * serverId: as permissões dos dois âmbitos acumulam-se, mas o que se
 * exige é server:manage, que nenhum cargo de crew concede. Um líder não
 * aceita a sua própria crew num servidor que não é dele.
 */
const affiliationRoutes: FastifyPluginAsync<AffiliationRoutesOptions> = async (
    fastify,
    options,
) => {
    const { controller } = options;

    /**
     * Onde a crew joga é parte do perfil dela, e o perfil é público.
     */
    fastify.get<{ Params: CrewIdParamDto }>(
        '/api/v1/crews/:crewId/affiliation',
        { schema: { params: crewIdParamSchema } },
        controller.getCrewAffiliation.bind(controller),
    );

    fastify.post<{ Params: CrewIdParamDto; Body: RequestAffiliationDto }>(
        '/api/v1/crews/:crewId/affiliation',
        {
            preHandler: [fastify.authenticate, fastify.authorize('crew:manage')],
            schema: { params: crewIdParamSchema, body: requestAffiliationSchema },
        },
        controller.request.bind(controller),
    );

    /**
     * Desistir do pedido e sair do servidor são duas coisas, e por isso
     * duas rotas: uma crew com pedido por responder não tem servidor, e
     * uma crew com servidor não tem pedido. Uma só rota teria de
     * adivinhar qual das duas quem carrega no botão queria desfazer.
     */
    fastify.delete<{ Params: CrewIdParamDto }>(
        '/api/v1/crews/:crewId/affiliation/request',
        {
            preHandler: [fastify.authenticate, fastify.authorize('crew:manage')],
            schema: { params: crewIdParamSchema },
        },
        controller.cancelRequest.bind(controller),
    );

    fastify.delete<{ Params: CrewIdParamDto }>(
        '/api/v1/crews/:crewId/affiliation',
        {
            preHandler: [fastify.authenticate, fastify.authorize('crew:manage')],
            schema: { params: crewIdParamSchema },
        },
        controller.leave.bind(controller),
    );

    /**
     * As crews que jogam neste servidor. É público, como o diretório:
     * faz parte do que o servidor mostra de si.
     */
    fastify.get<{ Params: ServerIdParamDto }>(
        '/api/v1/servers/:serverId/affiliations',
        { schema: { params: serverIdParamSchema } },
        controller.listActive.bind(controller),
    );

    /**
     * Os pedidos por responder são a caixa de entrada de quem gere o
     * servidor, e vivem numa rota à parte em vez de num parâmetro da
     * listagem pública: assim a permissão é uma propriedade da rota, e
     * não uma condição escrita dentro dela que um dia se esquece.
     */
    fastify.get<{ Params: ServerIdParamDto }>(
        '/api/v1/servers/:serverId/affiliations/requests',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('server:manage'),
            ],
            schema: { params: serverIdParamSchema },
        },
        controller.listRequests.bind(controller),
    );

    fastify.post<{ Params: AffiliationParamDto }>(
        '/api/v1/servers/:serverId/affiliations/:crewId/accept',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('server:manage'),
            ],
            schema: { params: affiliationParamSchema },
        },
        controller.accept.bind(controller),
    );

    fastify.post<{ Params: AffiliationParamDto }>(
        '/api/v1/servers/:serverId/affiliations/:crewId/reject',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('server:manage'),
            ],
            schema: { params: affiliationParamSchema },
        },
        controller.reject.bind(controller),
    );

    fastify.delete<{ Params: AffiliationParamDto }>(
        '/api/v1/servers/:serverId/affiliations/:crewId',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('server:manage'),
            ],
            schema: { params: affiliationParamSchema },
        },
        controller.remove.bind(controller),
    );
};

export default affiliationRoutes;
