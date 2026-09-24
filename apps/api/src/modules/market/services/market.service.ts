import {
    ANUNCIOS_POR_PAGINA,
    anuncioEstaFechado,
    type CategoriaDeAnuncio,
    type EstadoDeAnuncio,
} from '@vicehub/database';

import { MarketError } from '../errors/market.errors.js';
import type { MarketRepository } from '../repositories/market.repository.js';
import type {
    AnuncioResumo,
    AnuncioView,
    CamposDoAnuncio,
    MudancasDoAnuncio,
} from '../types/market.types.js';

export interface PaginaDeAnuncios {
    anuncios: AnuncioResumo[];
    /**
     * De que servidor é este mercado.
     *
     * Vai na resposta porque o servidor já foi lido para se poder
     * recusar um endereço que não existe — mandá-lo de volta não custa
     * uma consulta, e poupa ao ecrã um segundo pedido só para escrever
     * um nome no cabeçalho.
     */
    servidor: { id: string; name: string };
    pagina: number;
    paginas: number;
    total: number;
}

interface Filtro {
    serverId: string;
    status: EstadoDeAnuncio;
    category?: CategoriaDeAnuncio;
}

/**
 * O mercado de um servidor.
 *
 * Ler não pede sessão: um mercado com gente a vender é a prova mais
 * direta que um servidor tem de que a economia dele está viva, e
 * escondê-lo de quem ainda não tem conta era esconder o argumento.
 *
 * Anunciar pede sessão, a permissão, **e jogar lá**. A última é a que
 * interessa: sem ela, uma conta feita há dois minutos anunciava nos
 * trezentos servidores da plataforma ao mesmo tempo.
 *
 * Editar e fechar são de quem escreveu, e de mais ninguém. **Retirar é
 * das duas pessoas**: de quem escreveu, sempre, e de quem modera — e
 * essa segunda só passou a existir quando a fila de denúncias aprendeu
 * a receber anúncios. Um botão de retirar nas mãos de um moderador sem
 * ninguém ter por onde se queixar era a metade que não serve.
 */
export class MarketService {
    constructor(private readonly marketRepository: MarketRepository) { }

    async listListings(
        filtro: Filtro,
        pagina: number,
    ): Promise<PaginaDeAnuncios> {
        const servidor = await this.marketRepository.findServer(
            filtro.serverId,
        );

        if (servidor === null) {
            throw new MarketError(
                'SERVER_NOT_FOUND',
                'Este servidor não existe.',
            );
        }

        const [linhas, total] = await Promise.all([
            this.marketRepository.listListings(filtro, pagina),
            this.marketRepository.countListings(filtro),
        ]);

        /**
         * As notas dos vendedores desta página, de uma vez.
         *
         * Depois da lista e não ao mesmo tempo, porque só depois de a
         * ler se sabe de quem são os anúncios — e uma consulta para a
         * página toda é melhor do que vinte e quatro.
         */
        const notas = await this.marketRepository.ratingsFor(
            [
                ...new Set(
                    linhas.flatMap((linha) =>
                        linha.seller === null ? [] : [linha.seller.id],
                    ),
                ),
            ],
        );

        return {
            servidor,
            anuncios: linhas.map((linha) => ({
                id: linha.id,
                category: linha.category,
                title: linha.title,
                price: linha.price,
                imageUrl: linha.imageUrl,
                status: linha.status,
                seller: linha.seller,
                sellerRating:
                    linha.seller === null
                        ? null
                        : notas.get(linha.seller.id) ?? null,
                createdAt: linha.created_at,
                updatedAt: linha.updated_at,
            })),
            pagina,
            paginas: Math.max(1, Math.ceil(total / ANUNCIOS_POR_PAGINA)),
            total,
        };
    }

    async getListing(listingId: string): Promise<AnuncioView> {
        const anuncio = await this.marketRepository.findListing(listingId);

        if (anuncio === null) {
            throw new MarketError(
                'LISTING_NOT_FOUND',
                'Este anúncio não existe ou foi retirado.',
            );
        }

        const notas =
            anuncio.sellerId === null
                ? new Map()
                : await this.marketRepository.ratingsFor([anuncio.sellerId]);

        return {
            id: anuncio.id,
            category: anuncio.category,
            title: anuncio.title,
            body: anuncio.body,
            sellerRating:
                anuncio.sellerId === null
                    ? null
                    : notas.get(anuncio.sellerId) ?? null,
            price: anuncio.price,
            imageUrl: anuncio.imageUrl,
            status: anuncio.status,
            seller: anuncio.seller,
            sellerId: anuncio.sellerId,
            serverId: anuncio.serverId,
            serverName: anuncio.server.name,
            closedAt: anuncio.closed_at,
            createdAt: anuncio.created_at,
            updatedAt: anuncio.updated_at,
        };
    }

    async createListing(
        serverId: string,
        sellerId: string,
        input: CamposDoAnuncio,
    ): Promise<{ id: string }> {
        const servidor = await this.marketRepository.findServer(serverId);

        if (servidor === null) {
            throw new MarketError(
                'SERVER_NOT_FOUND',
                'Este servidor não existe.',
            );
        }

        const joga = await this.marketRepository.userPlaysOnServer(
            sellerId,
            serverId,
        );

        if (!joga) {
            throw new MarketError(
                'NOT_ON_SERVER',
                'Só quem joga neste servidor pode anunciar no mercado dele.',
            );
        }

        return this.marketRepository.createListing({
            serverId,
            sellerId,
            category: input.category,
            title: input.title,
            body: input.body,
            price: input.price,
            imageUrl: input.imageUrl ?? null,
        });
    }

    /**
     * O anúncio, se for desta pessoa e ainda estiver à venda.
     *
     * As três recusas — não existe, não é teu, já fechou — são as mesmas
     * para editar, fechar e retirar, e escrevê-las em cada um dava três
     * sítios onde a ordem podia divergir. A ordem importa: "não é teu"
     * antes de "já fechou" evita dizer a um estranho em que estado está
     * um anúncio que não lhe diz respeito.
     */
    private async meuEAberto(listingId: string, userId: string) {
        const anuncio = await this.marketRepository.findListing(listingId);

        if (anuncio === null) {
            throw new MarketError(
                'LISTING_NOT_FOUND',
                'Este anúncio não existe ou foi retirado.',
            );
        }

        if (anuncio.sellerId !== userId) {
            throw new MarketError(
                'NOT_YOURS',
                'Este anúncio não é teu.',
            );
        }

        if (anuncioEstaFechado(anuncio.status)) {
            throw new MarketError(
                'ALREADY_CLOSED',
                'Este anúncio já saiu da venda.',
            );
        }

        return anuncio;
    }

    async updateListing(
        listingId: string,
        userId: string,
        mudancas: MudancasDoAnuncio,
    ): Promise<{ id: string }> {
        await this.meuEAberto(listingId, userId);

        return this.marketRepository.updateListing(
            listingId,
            userId,
            mudancas,
        );
    }

    async closeListing(
        listingId: string,
        userId: string,
        outcome: 'sold' | 'withdrawn',
        agora: Date = new Date(),
    ): Promise<{ id: string }> {
        await this.meuEAberto(listingId, userId);

        return this.marketRepository.closeListing(
            listingId,
            userId,
            outcome,
            agora,
        );
    }

    /**
     * Retirar de vez.
     *
     * Ao contrário de editar e de fechar, isto vale para um anúncio já
     * fechado: quem vendeu uma coisa continua a poder tirar do mercado
     * o que escreveu sobre ela.
     */
    async removeListing(
        listingId: string,
        userId: string,
        podeModerar = false,
        agora: Date = new Date(),
    ): Promise<void> {
        const anuncio = await this.marketRepository.findListing(listingId);

        if (anuncio === null) {
            throw new MarketError(
                'LISTING_NOT_FOUND',
                'Este anúncio não existe ou foi retirado.',
            );
        }

        if (!podeModerar && anuncio.sellerId !== userId) {
            throw new MarketError('NOT_YOURS', 'Este anúncio não é teu.');
        }

        await this.marketRepository.softDeleteListing(
            listingId,
            userId,
            agora,
        );
    }
}
