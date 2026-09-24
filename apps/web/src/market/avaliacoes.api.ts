import { api } from '../lib/api.js';
import type { Vendedor } from './market.api.js';

/**
 * As avaliações de uma venda.
 *
 * **Públicas**, ao contrário das conversas: quem está a decidir se
 * compra a alguém pode nem ter conta, e ler não pede sessão.
 */
export const AVALIACAO_MINIMA = 1;
export const AVALIACAO_MAXIMA = 5;

/**
 * O tecto do texto, dito antes de o pedido sair.
 *
 * A regra a sério é a do servidor. Esta existe para o campo parar onde
 * ele pára.
 */
export const AVALIACAO_TEXTO_MAXIMO = 1_000;

export interface Avaliacao {
    id: string;
    rating: number;
    body: string | null;
    /** A resposta de quem foi avaliado. Uma só. */
    reply: string | null;
    repliedAt: string | null;
    reviewer: Vendedor | null;
    listing: { id: string; title: string };
    createdAt: string;
}

export interface ResumoDeAvaliacoes {
    /** `null` quando não há nenhuma — e não zero, que é uma nota. */
    average: number | null;
    count: number;
}

export interface PaginaDeAvaliacoes {
    reviews: Avaliacao[];
    summary: ResumoDeAvaliacoes;
    page: number;
    pages: number;
    total: number;
}

export const listReviews = (
    username: string,
    page = 1,
): Promise<PaginaDeAvaliacoes> =>
    api<PaginaDeAvaliacoes>(
        `/market/people/${encodeURIComponent(username)}/reviews?page=${page}`,
    );

export const createReview = (
    listingId: string,
    rating: number,
    body?: string,
): Promise<{ id: string }> =>
    api<{ id: string }>(
        `/market/listings/${encodeURIComponent(listingId)}/reviews`,
        { method: 'POST', body: { rating, ...(body ? { body } : {}) } },
    );

export const replyToReview = (
    reviewId: string,
    body: string,
): Promise<{ id: string }> =>
    api<{ id: string }>(
        `/market/reviews/${encodeURIComponent(reviewId)}/reply`,
        { method: 'POST', body: { body } },
    );

export const removeReview = (reviewId: string): Promise<void> =>
    api<void>(`/market/reviews/${encodeURIComponent(reviewId)}`, {
        method: 'DELETE',
    });
