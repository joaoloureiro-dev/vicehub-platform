import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import type { ForumController } from './controllers/forum.controller.js';
import {
    createReplySchema,
    createTopicSchema,
    listTopicsQuerySchema,
    replyIdParamSchema,
    topicIdParamSchema,
    type CreateReplyDto,
    type CreateTopicDto,
    type ListTopicsQueryDto,
    type ReplyIdParamDto,
    type TopicIdParamDto,
} from './schemas/forum.schemas.js';

interface ForumRoutesOptions {
    controller: ForumController;
}

/**
 * O fórum.
 *
 * **Ler não pede sessão.** Uma pergunta respondida vale sobretudo para
 * quem chega de uma pesquisa sem conta nenhuma, e fechá-la atrás de um
 * registo faria a plataforma responder à mesma pergunta vezes sem conta.
 *
 * Escrever pede sessão **e** a permissão `forum:post`, que o cargo de
 * jogador traz. São duas coisas e não uma: o dia em que for preciso
 * calar alguém sem lhe apagar a conta, tira-se-lhe a permissão.
 */
const forumRoutes: FastifyPluginAsync<ForumRoutesOptions> = async (
    fastify,
    { controller },
) => {

    /**
     * Escrever leva um limite próprio, muito mais apertado do que o
     * global. É a única superfície onde qualquer pessoa registada deixa
     * texto à vista de toda a gente, e sem isto uma conta com um guião
     * enche o fórum mais depressa do que alguém o limpa.
     */
    const limiteDeEscrita = {
        rateLimit: {
            max: env.FORUM_RATE_LIMIT_MAX,
            timeWindow: env.FORUM_RATE_LIMIT_WINDOW,
        },
    };

    fastify.get<{ Querystring: ListTopicsQueryDto }>(
        '/topics',
        { schema: { querystring: listTopicsQuerySchema } },
        controller.list.bind(controller),
    );

    fastify.get<{ Params: TopicIdParamDto }>(
        '/topics/:topicId',
        { schema: { params: topicIdParamSchema } },
        controller.get.bind(controller),
    );

    fastify.post<{ Body: CreateTopicDto }>(
        '/topics',
        {
            preHandler: [fastify.authenticate, fastify.authorize('forum:post')],
            config: limiteDeEscrita,
            schema: { body: createTopicSchema },
        },
        controller.create.bind(controller),
    );

    fastify.post<{ Params: TopicIdParamDto; Body: CreateReplyDto }>(
        '/topics/:topicId/replies',
        {
            preHandler: [fastify.authenticate, fastify.authorize('forum:post')],
            config: limiteDeEscrita,
            schema: { params: topicIdParamSchema, body: createReplySchema },
        },
        controller.reply.bind(controller),
    );

    /**
     * Retirar exige `forum:post` e mais nada.
     *
     * Quem pode retirar **este** tópico é decidido no serviço: quem o
     * escreveu, sempre, e quem tiver `forum:moderate`. Exigir a
     * permissão de moderação à entrada fecharia a porta a quem quer
     * apagar o que ele próprio escreveu — que é o caso mais comum de
     * todos, e o que uma pessoa espera poder fazer sem pedir a ninguém.
     *
     * O preHandler continua a ser preciso: é ele que reúne as permissões
     * do pedido, e é delas que o serviço sabe quem modera.
     */
    fastify.delete<{ Params: TopicIdParamDto }>(
        '/topics/:topicId',
        {
            preHandler: [fastify.authenticate, fastify.authorize('forum:post')],
            schema: { params: topicIdParamSchema },
        },
        controller.removeTopic.bind(controller),
    );

    fastify.delete<{ Params: ReplyIdParamDto }>(
        '/replies/:replyId',
        {
            preHandler: [fastify.authenticate, fastify.authorize('forum:post')],
            schema: { params: replyIdParamSchema },
        },
        controller.removeReply.bind(controller),
    );
};

export default forumRoutes;
