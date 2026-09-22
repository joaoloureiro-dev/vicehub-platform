import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import type { ForumController } from './controllers/forum.controller.js';
import {
    createReplySchema,
    createReportSchema,
    createTopicSchema,
    handleReportSchema,
    listReportsQuerySchema,
    listTopicsQuerySchema,
    replyIdParamSchema,
    reportIdParamSchema,
    topicIdParamSchema,
    type CreateReplyDto,
    type CreateReportDto,
    type CreateTopicDto,
    type HandleReportDto,
    type ListReportsQueryDto,
    type ListTopicsQueryDto,
    type ReplyIdParamDto,
    type ReportIdParamDto,
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

    /**
     * Fechar e reabrir uma pergunta.
     *
     * Exigem `forum:moderate` à porta, ao contrário de retirar: fechar
     * não é uma coisa que o autor faça ao que é seu. Quem pergunta não
     * é dono da conversa que a resposta dele abriu.
     *
     * Dois verbos e um caminho em vez de um interruptor com um corpo:
     * fechar e reabrir são coisas diferentes, e repeti-las não muda
     * nada — o que importa é em que estado fica, e não quantas vezes lá
     * bateram.
     */
    fastify.post<{ Params: TopicIdParamDto }>(
        '/topics/:topicId/lock',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('forum:moderate'),
            ],
            schema: { params: topicIdParamSchema },
        },
        controller.lock.bind(controller),
    );

    fastify.delete<{ Params: TopicIdParamDto }>(
        '/topics/:topicId/lock',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('forum:moderate'),
            ],
            schema: { params: topicIdParamSchema },
        },
        controller.unlock.bind(controller),
    );

    /**
     * Denunciar uma publicação.
     *
     * Pede sessão e `forum:post`, como escrever: denunciar é uma coisa
     * que se faz com uma conta, e tirar a permissão a quem abusa do
     * fórum tira-lhe as duas — o que é o que se quer, porque quem enche
     * o fórum de lixo também enche a fila de denúncias.
     *
     * E leva o limite da escrita, pela mesma razão: é um pedido que
     * qualquer pessoa registada pode fazer em massa, e a fila de um
     * moderador é precisamente o sítio onde isso magoa.
     */
    fastify.post<{ Params: TopicIdParamDto; Body: CreateReportDto }>(
        '/topics/:topicId/reports',
        {
            preHandler: [fastify.authenticate, fastify.authorize('forum:post')],
            config: limiteDeEscrita,
            schema: { params: topicIdParamSchema, body: createReportSchema },
        },
        controller.reportTopic.bind(controller),
    );

    fastify.post<{ Params: ReplyIdParamDto; Body: CreateReportDto }>(
        '/replies/:replyId/reports',
        {
            preHandler: [fastify.authenticate, fastify.authorize('forum:post')],
            config: limiteDeEscrita,
            schema: { params: replyIdParamSchema, body: createReportSchema },
        },
        controller.reportReply.bind(controller),
    );

    /**
     * A fila de quem modera, e o fechar de cada denúncia.
     *
     * `forum:moderate` nas duas: a fila mostra texto que alguém achou
     * mau o suficiente para avisar, com o nome de quem avisou. É o
     * contrário de uma coisa para se ver de fora.
     *
     * Ler a fila não leva limite, como nenhuma leitura leva: um
     * moderador a percorrer denúncias depressa está a trabalhar, e um
     * limite aqui dava-lhe um erro por isso.
     */
    fastify.get<{ Querystring: ListReportsQueryDto }>(
        '/reports',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('forum:moderate'),
            ],
            schema: { querystring: listReportsQuerySchema },
        },
        controller.listReports.bind(controller),
    );

    fastify.post<{ Params: ReportIdParamDto; Body: HandleReportDto }>(
        '/reports/:reportId',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('forum:moderate'),
            ],
            schema: { params: reportIdParamSchema, body: handleReportSchema },
        },
        controller.handleReport.bind(controller),
    );

    /**
     * Se quem pergunta modera, para o ecrã saber que ferramentas
     * mostrar.
     *
     * Exige sessão e mais nada: a resposta a quem não modera é `false`,
     * e não uma recusa. Uma rota que respondesse 403 a toda a gente sem
     * cargo obrigava o ecrã a tratar um erro como se fosse uma resposta.
     */
    fastify.get(
        '/moderation',
        { preHandler: [fastify.authenticate, fastify.authorize('forum:post')] },
        controller.moderation.bind(controller),
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
