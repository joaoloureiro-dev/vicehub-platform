import type { FastifyPluginAsync } from 'fastify';

import type { SubscriptionController } from './controllers/subscription.controller.js';
import type {
    CrewScopeParamDto,
    GrantSubscriptionDto,
    ServerScopeParamDto,
    SubscriptionIdParamDto,
} from './dto/subscription.dto.js';
import {
    crewScopeParamSchema,
    grantSubscriptionSchema,
    serverScopeParamSchema,
    subscriptionIdParamSchema,
} from './schemas/subscription.schemas.js';

interface SubscriptionRoutesOptions {
    controller: SubscriptionController;
}

/**
 * Rotas do módulo de subscrições.
 *
 * Conceder um plano é, por agora, um ato de administração: não existe
 * ainda compra pelo próprio. Quando o pagamento entrar, o provedor passa
 * a ser outro caminho para o mesmo registo de período, e esta rota fica
 * para ofertas e compensações.
 */
const subscriptionRoutes: FastifyPluginAsync<SubscriptionRoutesOptions> = async (
    fastify,
    options,
) => {
    const { controller } = options;

    fastify.post<{ Body: GrantSubscriptionDto }>(
        '/grant',
        {
            preHandler: [fastify.authenticate, fastify.authorize('system:manage')],
            schema: { body: grantSubscriptionSchema },
        },
        controller.grant.bind(controller),
    );

    /**
     * Cancelar é também de administração enquanto não houver compra pelo
     * próprio: uma subscrição pode ser de uma crew, e decidir quem a pode
     * cancelar é a mesma pergunta que decidir quem a pode comprar.
     */
    fastify.post<{ Params: SubscriptionIdParamDto }>(
        '/:subscriptionId/cancel',
        {
            preHandler: [fastify.authenticate, fastify.authorize('system:manage')],
            schema: { params: subscriptionIdParamSchema },
        },
        controller.cancel.bind(controller),
    );

    /**
     * Retirar uma subscrição com efeito imediato.
     *
     * Existe sobretudo por causa do vitalício: não tendo período que
     * acabe, o cancelamento no fim do período não lhe faz nada, e um
     * acesso oferecido por engano ficaria sem forma de ser retirado.
     */
    fastify.post<{ Params: SubscriptionIdParamDto }>(
        '/:subscriptionId/revoke',
        {
            preHandler: [fastify.authenticate, fastify.authorize('system:manage')],
            schema: { params: subscriptionIdParamSchema },
        },
        controller.revoke.bind(controller),
    );

    /**
     * O próprio vê sempre o seu plano, sem precisar de permissão nenhuma.
     */
    fastify.get(
        '/me',
        { preHandler: [fastify.authenticate] },
        controller.getMine.bind(controller),
    );

    /**
     * O histórico de faturação de uma crew ou servidor é de quem manda
     * lá dentro, e não de qualquer membro: o perfil público já diz se há
     * plano ativo, o que falta aqui é quanto e desde quando.
     */
    fastify.get<{ Params: CrewScopeParamDto }>(
        '/crews/:crewId',
        {
            preHandler: [fastify.authenticate, fastify.authorize('crew:manage')],
            schema: { params: crewScopeParamSchema },
        },
        controller.getCrew.bind(controller),
    );

    fastify.get<{ Params: ServerScopeParamDto }>(
        '/servers/:serverId',
        {
            preHandler: [fastify.authenticate, fastify.authorize('server:manage')],
            schema: { params: serverScopeParamSchema },
        },
        controller.getServer.bind(controller),
    );
};

export default subscriptionRoutes;
