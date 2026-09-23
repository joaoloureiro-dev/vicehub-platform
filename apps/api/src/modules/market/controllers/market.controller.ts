import type { FastifyReply, FastifyRequest } from 'fastify';

import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import { MarketError } from '../errors/market.errors.js';
import type {
    CloseListingDto,
    CreateListingDto,
    ListListingsQueryDto,
    ListingIdParamDto,
    ServerIdParamDto,
    UpdateListingDto,
} from '../schemas/market.schemas.js';
import type { MarketService } from '../services/market.service.js';
import type { AnuncioResumo, AnuncioView } from '../types/market.types.js';

/** Que resposta HTTP corresponde a cada recusa. */
const ESTADO: Record<string, number> = {
    LISTING_NOT_FOUND: 404,
    SERVER_NOT_FOUND: 404,
    NOT_ON_SERVER: 403,
    NOT_YOURS: 403,
    ALREADY_CLOSED: 409,
};

/**
 * O preço sai como **texto**, e não como número.
 *
 * É `BigInt` na base de dados e no serviço, e um `BigInt` nem sequer
 * cabe em JSON. Mandá-lo como número obrigava a passar por `double`, e
 * um preço de novecentos mil milhões voltava arredondado — que é a
 * espécie de erro que ninguém nota até alguém discutir uma venda.
 */
const emJson = (anuncio: AnuncioResumo) => ({
    ...anuncio,
    price: anuncio.price.toString(),
    createdAt: anuncio.createdAt.toISOString(),
    updatedAt: anuncio.updatedAt.toISOString(),
});

const inteiroEmJson = (anuncio: AnuncioView) => ({
    ...emJson(anuncio),
    body: anuncio.body,
    serverId: anuncio.serverId,
    serverName: anuncio.serverName,
    sellerId: anuncio.sellerId,
    closedAt: anuncio.closedAt === null ? null : anuncio.closedAt.toISOString(),
});

export class MarketController {
    constructor(private readonly marketService: MarketService) { }

    async list(
        request: FastifyRequest<{
            Params: ServerIdParamDto;
            Querystring: ListListingsQueryDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        try {
            const { page, status, category } = request.query;

            const pagina = await this.marketService.listListings(
                {
                    serverId: request.params.serverId,
                    status,
                    ...(category === undefined ? {} : { category }),
                },
                page,
            );

            reply.send({
                server: pagina.servidor,
                listings: pagina.anuncios.map(emJson),
                page: pagina.pagina,
                pages: pagina.paginas,
                total: pagina.total,
            });
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    async get(
        request: FastifyRequest<{ Params: ListingIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        try {
            const anuncio = await this.marketService.getListing(
                request.params.listingId,
            );

            reply.send(inteiroEmJson(anuncio));
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    async create(
        request: FastifyRequest<{
            Params: ServerIdParamDto;
            Body: CreateListingDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        try {
            const criado = await this.marketService.createListing(
                request.params.serverId,
                user.id,
                request.body,
            );

            reply.code(201).send(criado);
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    async update(
        request: FastifyRequest<{
            Params: ListingIdParamDto;
            Body: UpdateListingDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        try {
            const mudado = await this.marketService.updateListing(
                request.params.listingId,
                user.id,
                request.body,
            );

            reply.send(mudado);
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    async close(
        request: FastifyRequest<{
            Params: ListingIdParamDto;
            Body: CloseListingDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        try {
            const fechado = await this.marketService.closeListing(
                request.params.listingId,
                user.id,
                request.body.outcome,
            );

            reply.send(fechado);
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    async remove(
        request: FastifyRequest<{ Params: ListingIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        try {
            await this.marketService.removeListing(
                request.params.listingId,
                user.id,
            );

            reply.code(204).send();
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    private responder(erro: unknown, reply: FastifyReply): void {
        if (erro instanceof MarketError) {
            reply
                .code(ESTADO[erro.code] ?? 400)
                .send({ code: erro.code, message: erro.message });

            return;
        }

        throw erro;
    }
}
