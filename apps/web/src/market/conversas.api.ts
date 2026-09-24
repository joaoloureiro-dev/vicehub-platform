import { api } from '../lib/api.js';
import type { EstadoDeAnuncio, Vendedor } from './market.api.js';

/**
 * As conversas sobre um anúncio.
 *
 * **Nenhuma destas chamadas é pública**, ao contrário do resto do
 * mercado: uma conversa é de duas pessoas, e ler uma pede sessão como
 * escrever nela.
 */
export const MENSAGEM_MAXIMA = 2_000;

export interface AnuncioDaConversa {
    id: string;
    title: string;
    price: string;
    status: EstadoDeAnuncio;
    isRemoved: boolean;
}

export interface Mensagem {
    id: string;
    body: string;
    sender: Vendedor | null;
    /** Para o ecrã saber de que lado a desenhar. */
    isMine: boolean;
    createdAt: string;
}

export interface Conversa {
    id: string;
    listing: AnuncioDaConversa;
    buyer: Vendedor | null;
    seller: Vendedor | null;
    messages: Mensagem[];
}

export interface ConversaNaCaixa {
    id: string;
    listing: AnuncioDaConversa;
    /** Quem está do outro lado, visto de quem pede a lista. */
    comQuem: Vendedor | null;
    ultima: { body: string; isMine: boolean; createdAt: string } | null;
    updatedAt: string;
}

export interface CaixaDeEntrada {
    conversations: ConversaNaCaixa[];
    page: number;
    pages: number;
    total: number;
}

export const openConversation = (listingId: string): Promise<{ id: string }> =>
    api<{ id: string }>(
        `/market/listings/${encodeURIComponent(listingId)}/conversations`,
        { method: 'POST' },
    );

export const listConversations = (page = 1): Promise<CaixaDeEntrada> =>
    api<CaixaDeEntrada>(`/market/conversations?page=${page}`);

export const getConversation = (conversationId: string): Promise<Conversa> =>
    api<Conversa>(
        `/market/conversations/${encodeURIComponent(conversationId)}`,
    );

export const sendMessage = (
    conversationId: string,
    body: string,
): Promise<{ id: string }> =>
    api<{ id: string }>(
        `/market/conversations/${encodeURIComponent(conversationId)}/messages`,
        { method: 'POST', body: { body } },
    );

export const removeMessage = (messageId: string): Promise<void> =>
    api<void>(`/market/messages/${encodeURIComponent(messageId)}`, {
        method: 'DELETE',
    });
