import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import type { MarketController } from './controllers/market.controller.js';
import {
    closeListingSchema,
    createListingSchema,
    listListingsQuerySchema,
    listingIdParamSchema,
    serverIdParamSchema,
    updateListingSchema,
    type CloseListingDto,
    type CreateListingDto,
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
    { controller },
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
};

export default marketRoutes;
