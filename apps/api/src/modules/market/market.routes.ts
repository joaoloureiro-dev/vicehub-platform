import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import type { MarketController } from './controllers/market.controller.js';
import type { ConversationController } from './controllers/conversation.controller.js';
import type { ReviewController } from './controllers/review.controller.js';
import {
    closeListingSchema,
    conversationIdParamSchema,
    createListingSchema,
    createReviewSchema,
    listReviewsQuerySchema,
    replyToReviewSchema,
    reviewIdParamSchema,
    usernameParamSchema,
    listConversationsQuerySchema,
    messageIdParamSchema,
    sendMessageSchema,
    listListingsQuerySchema,
    listingIdParamSchema,
    serverIdParamSchema,
    updateListingSchema,
    type CloseListingDto,
    type ConversationIdParamDto,
    type CreateListingDto,
    type CreateReviewDto,
    type ListReviewsQueryDto,
    type ReplyToReviewDto,
    type ReviewIdParamDto,
    type UsernameParamDto,
    type ListConversationsQueryDto,
    type MessageIdParamDto,
    type SendMessageDto,
    type ListListingsQueryDto,
    type ListingIdParamDto,
    type ServerIdParamDto,
    type UpdateListingDto,
} from './schemas/market.schemas.js';
import {
    createReportSchema,
    type CreateReportDto,
} from '../moderation/schemas/moderation.schemas.js';

interface MarketRoutesOptions {
    controller: MarketController;
    conversations: ConversationController;
    reviews: ReviewController;
}

/**
 * O mercado.
 *
 * **Ler não pede sessão.** Um mercado com gente a vender é a prova mais
 * direta que um servidor tem de que a economia dele está viva, e a
 * pessoa que está a escolher onde jogar ainda não tem conta.
 *
 * **Anunciar pede três coisas**: sessão, a permissão `marketplace:post`,
 * e jogar no servidor — esta última verificada no serviço, porque não é
 * uma permissão mas uma relação. As duas primeiras são separadas pela
 * mesma razão do fórum: o dia em que for preciso calar alguém sem lhe
 * apagar a conta, tira-se-lhe a permissão.
 */
const marketRoutes: FastifyPluginAsync<MarketRoutesOptions> = async (
    fastify,
    { controller, conversations, reviews },
) => {

    /**
     * Anunciar leva o limite de escrita do fórum.
     *
     * É o mesmo número porque é o mesmo problema — uma conta com um
     * guião a encher uma lista pública mais depressa do que alguém a
     * limpa — e dar-lhe uma variável própria era escrever a mesma regra
     * duas vezes para as duas poderem divergir.
     */
    const limiteDeEscrita = {
        rateLimit: {
            max: env.FORUM_RATE_LIMIT_MAX,
            timeWindow: env.FORUM_RATE_LIMIT_WINDOW,
        },
    };

    fastify.get<{
        Params: ServerIdParamDto;
        Querystring: ListListingsQueryDto;
    }>(
        '/servers/:serverId/listings',
        {
            schema: {
                params: serverIdParamSchema,
                querystring: listListingsQuerySchema,
            },
        },
        controller.list.bind(controller),
    );

    fastify.get<{ Params: ListingIdParamDto }>(
        '/listings/:listingId',
        { schema: { params: listingIdParamSchema } },
        controller.get.bind(controller),
    );

    fastify.post<{ Params: ServerIdParamDto; Body: CreateListingDto }>(
        '/servers/:serverId/listings',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('marketplace:post'),
            ],
            config: limiteDeEscrita,
            schema: {
                params: serverIdParamSchema,
                body: createListingSchema,
            },
        },
        controller.create.bind(controller),
    );

    /**
     * Editar não leva o limite de escrita.
     *
     * Quem baixa o preço três vezes numa tarde está a vender, e não a
     * inundar nada: o anúncio continua a ser um. O limite existe para
     * travar quem cria, e aplicá-lo aqui castigava o uso normal.
     */
    fastify.patch<{ Params: ListingIdParamDto; Body: UpdateListingDto }>(
        '/listings/:listingId',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('marketplace:post'),
            ],
            schema: {
                params: listingIdParamSchema,
                body: updateListingSchema,
            },
        },
        controller.update.bind(controller),
    );

    /**
     * Fechar, com o resultado no corpo.
     *
     * Uma rota e duas conclusões, e não duas rotas: fechar é uma decisão
     * só, e o que muda é como é que aquilo acabou.
     */
    fastify.post<{ Params: ListingIdParamDto; Body: CloseListingDto }>(
        '/listings/:listingId/close',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('marketplace:post'),
            ],
            schema: {
                params: listingIdParamSchema,
                body: closeListingSchema,
            },
        },
        controller.close.bind(controller),
    );

    /**
     * Denunciar um anúncio.
     *
     * Pede sessão e `marketplace:post`, como anunciar: denunciar é uma
     * coisa que se faz com uma conta, e tirar a permissão a quem abusa
     * do mercado tira-lhe as duas — o que é o que se quer, porque quem
     * enche o mercado de lixo também enche a fila de denúncias.
     *
     * E leva o limite da escrita, pela mesma razão: é um pedido que
     * qualquer pessoa registada pode fazer em massa, e a fila de um
     * moderador é precisamente o sítio onde isso magoa.
     */
    fastify.post<{ Params: ListingIdParamDto; Body: CreateReportDto }>(
        '/listings/:listingId/reports',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('marketplace:post'),
            ],
            config: limiteDeEscrita,
            schema: {
                params: listingIdParamSchema,
                body: createReportSchema,
            },
        },
        controller.report.bind(controller),
    );

    /**
     * Retirar exige `marketplace:post` e mais nada.
     *
     * Quem pode retirar **este** anúncio é decidido no serviço: quem o
     * escreveu, sempre, e quem tiver `marketplace:moderate`. Exigir a
     * permissão de moderação à entrada fecharia a porta a quem quer
     * apagar o que ele próprio anunciou — que é o caso mais comum de
     * todos.
     *
     * O preHandler continua a ser preciso: é ele que reúne as
     * permissões do pedido, e é delas que o serviço sabe quem modera.
     */
    fastify.delete<{ Params: ListingIdParamDto }>(
        '/listings/:listingId',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('marketplace:post'),
            ],
            schema: { params: listingIdParamSchema },
        },
        controller.remove.bind(controller),
    );

    /**
     * As conversas sobre um anúncio.
     *
     * **Nada disto é público.** Uma conversa é de duas pessoas, e todas
     * estas rotas pedem sessão — a de ler inclusive, ao contrário de
     * tudo o resto no mercado. Quem não está na conversa recebe a mesma
     * resposta de quem pede uma conversa que não existe.
     *
     * Pedem `marketplace:post`, como anunciar: é a permissão de
     * participar no mercado, e tirá-la a quem abusa dele tira-lhe as
     * duas coisas de uma vez.
     */
    fastify.post<{ Params: ListingIdParamDto }>(
        '/listings/:listingId/conversations',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('marketplace:post'),
            ],
            config: limiteDeEscrita,
            schema: { params: listingIdParamSchema },
        },
        conversations.open.bind(conversations),
    );

    fastify.get<{ Querystring: ListConversationsQueryDto }>(
        '/conversations',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('marketplace:post'),
            ],
            schema: { querystring: listConversationsQuerySchema },
        },
        conversations.list.bind(conversations),
    );

    fastify.get<{ Params: ConversationIdParamDto }>(
        '/conversations/:conversationId',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('marketplace:post'),
            ],
            schema: { params: conversationIdParamSchema },
        },
        conversations.get.bind(conversations),
    );

    /**
     * Escrever leva o limite, como tudo o que uma conta pode fazer em
     * massa contra outra pessoa.
     */
    fastify.post<{ Params: ConversationIdParamDto; Body: SendMessageDto }>(
        '/conversations/:conversationId/messages',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('marketplace:post'),
            ],
            config: limiteDeEscrita,
            schema: {
                params: conversationIdParamSchema,
                body: sendMessageSchema,
            },
        },
        conversations.send.bind(conversations),
    );

    fastify.post<{ Params: MessageIdParamDto; Body: CreateReportDto }>(
        '/messages/:messageId/reports',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('marketplace:post'),
            ],
            config: limiteDeEscrita,
            schema: {
                params: messageIdParamSchema,
                body: createReportSchema,
            },
        },
        conversations.report.bind(conversations),
    );

    /**
     * Retirar uma mensagem exige `marketplace:post`, como retirar um
     * anúncio: quem pode retirar **esta** decide-se no serviço — quem a
     * escreveu, sempre, e quem modera.
     */
    fastify.delete<{ Params: MessageIdParamDto }>(
        '/messages/:messageId',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('marketplace:post'),
            ],
            schema: { params: messageIdParamSchema },
        },
        conversations.removeMessage.bind(conversations),
    );

    /**
     * As avaliações de uma venda.
     *
     * **Ler não pede sessão**, ao contrário das conversas: uma
     * avaliação é pública, e quem está a decidir se compra a alguém
     * pode nem ter conta. É essa a diferença entre esta superfície e a
     * das mensagens, e é por isso que as duas não podem partilhar a
     * mesma regra.
     */
    fastify.get<{ Params: UsernameParamDto; Querystring: ListReviewsQueryDto }>(
        '/people/:username/reviews',
        {
            schema: {
                params: usernameParamSchema,
                querystring: listReviewsQuerySchema,
            },
        },
        reviews.list.bind(reviews),
    );

    fastify.post<{ Params: ListingIdParamDto; Body: CreateReviewDto }>(
        '/listings/:listingId/reviews',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('marketplace:post'),
            ],
            config: limiteDeEscrita,
            schema: {
                params: listingIdParamSchema,
                body: createReviewSchema,
            },
        },
        reviews.create.bind(reviews),
    );

    /**
     * A resposta de quem foi avaliado. Uma só — a segunda é recusada
     * pelo serviço, e não por não haver rota.
     */
    fastify.post<{ Params: ReviewIdParamDto; Body: ReplyToReviewDto }>(
        '/reviews/:reviewId/reply',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('marketplace:post'),
            ],
            config: limiteDeEscrita,
            schema: {
                params: reviewIdParamSchema,
                body: replyToReviewSchema,
            },
        },
        reviews.reply.bind(reviews),
    );

    fastify.post<{ Params: ReviewIdParamDto; Body: CreateReportDto }>(
        '/reviews/:reviewId/reports',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('marketplace:post'),
            ],
            config: limiteDeEscrita,
            schema: {
                params: reviewIdParamSchema,
                body: createReportSchema,
            },
        },
        reviews.report.bind(reviews),
    );

    /**
     * Retirar uma avaliação é de quem a escreveu e de quem modera —
     * **nunca de quem foi avaliado**. Isso decide-se no serviço; aqui
     * pede-se a permissão de participar no mercado, como em tudo o
     * resto.
     */
    fastify.delete<{ Params: ReviewIdParamDto }>(
        '/reviews/:reviewId',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('marketplace:post'),
            ],
            schema: { params: reviewIdParamSchema },
        },
        reviews.remove.bind(reviews),
    );
};

export default marketRoutes;
