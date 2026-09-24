import { api } from '../lib/api.js';

/**
 * As gavetas e os estados, escritos outra vez deste lado.
 *
 * A interface não importa do package de dados — traria o Prisma para
 * dentro do browser —, e a regra a sério continua a ser a do servidor.
 * O que está aqui é o que o ecrã precisa de saber para desenhar as
 * opções, e há um teste que falha se as duas listas deixarem de ser a
 * mesma.
 */
export const CATEGORIAS: readonly CategoriaDeAnuncio[] = [
    'vehicle',
    'property',
    'business',
    'service',
    'item',
    'other',
];

export type CategoriaDeAnuncio =
    | 'vehicle'
    | 'property'
    | 'business'
    | 'service'
    | 'item'
    | 'other';

export type EstadoDeAnuncio = 'open' | 'sold' | 'withdrawn';

/**
 * Os limites do texto, ditos antes de o pedido sair.
 *
 * Como no fórum: a regra a sério é a do servidor, e estes existem para
 * o campo parar onde ele pára em vez de deixar escrever quatro mil e
 * um caracteres para depois lhos recusarem.
 */
export const TITULO_MAXIMO = 120;
export const CORPO_MAXIMO = 4_000;

export interface Vendedor {
    id: string;
    username: string;
    avatarUrl: string | null;
}

/**
 * O preço chega como **texto**, e fica texto.
 *
 * É `BigInt` do outro lado, e um preço de novecentos mil milhões que
 * passe por `Number` volta arredondado. Aqui não se faz conta nenhuma
 * com ele — mostra-se —, por isso o texto é a forma certa de o guardar.
 */
export interface AnuncioResumo {
    id: string;
    category: CategoriaDeAnuncio;
    title: string;
    price: string;
    imageUrl: string | null;
    status: EstadoDeAnuncio;
    seller: Vendedor | null;
    /**
     * A nota de quem vende, onde a decisão se toma.
     *
     * `null` quando ainda não tem nenhuma. Não é zero: zero é a pior
     * nota da escala, e um mercado que a desse a quem começa punha os
     * novos abaixo dos maus.
     */
    sellerRating: { average: number; count: number } | null;
    createdAt: string;
    updatedAt: string;
}

export interface Anuncio extends AnuncioResumo {
    body: string;
    serverId: string;
    serverName: string;
    sellerId: string | null;
    closedAt: string | null;
}

export interface PaginaDeAnuncios {
    /** De que servidor é este mercado, para o cabeçalho o poder dizer. */
    server: { id: string; name: string };
    listings: AnuncioResumo[];
    page: number;
    pages: number;
    total: number;
}

export interface FiltroDoMercado {
    page?: number;
    category?: CategoriaDeAnuncio;
    status?: EstadoDeAnuncio;
}

const query = (filtro: FiltroDoMercado): string => {
    const partes = new URLSearchParams();

    if (filtro.page !== undefined && filtro.page > 1) {
        partes.set('page', String(filtro.page));
    }

    if (filtro.category !== undefined) {
        partes.set('category', filtro.category);
    }

    /**
     * O estado só vai quando não é o normal. A omissão é o aberto, e
     * mandá-lo sempre fazia os endereços de toda a gente carregarem uma
     * escolha que ninguém fez.
     */
    if (filtro.status !== undefined && filtro.status !== 'open') {
        partes.set('status', filtro.status);
    }

    const texto = partes.toString();

    return texto === '' ? '' : `?${texto}`;
};

export const listListings = (
    serverId: string,
    filtro: FiltroDoMercado = {},
): Promise<PaginaDeAnuncios> =>
    api<PaginaDeAnuncios>(
        `/market/servers/${encodeURIComponent(serverId)}/listings${query(filtro)}`,
    );

export const getListing = (listingId: string): Promise<Anuncio> =>
    api<Anuncio>(`/market/listings/${encodeURIComponent(listingId)}`);

export interface CamposDoAnuncio {
    category: CategoriaDeAnuncio;
    title: string;
    body: string;
    price: string;
    imageUrl?: string | null;
}

export const createListing = (
    serverId: string,
    campos: CamposDoAnuncio,
): Promise<{ id: string }> =>
    api<{ id: string }>(
        `/market/servers/${encodeURIComponent(serverId)}/listings`,
        { method: 'POST', body: campos },
    );

export const updateListing = (
    listingId: string,
    mudancas: Partial<CamposDoAnuncio>,
): Promise<{ id: string }> =>
    api<{ id: string }>(`/market/listings/${encodeURIComponent(listingId)}`, {
        method: 'PATCH',
        body: mudancas,
    });

export const closeListing = (
    listingId: string,
    outcome: 'sold' | 'withdrawn',
): Promise<{ id: string }> =>
    api<{ id: string }>(
        `/market/listings/${encodeURIComponent(listingId)}/close`,
        { method: 'POST', body: { outcome } },
    );

export const removeListing = (listingId: string): Promise<void> =>
    api<void>(`/market/listings/${encodeURIComponent(listingId)}`, {
        method: 'DELETE',
    });
