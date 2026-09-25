import { api } from '../lib/api.js';

/**
 * A caixa de avisos.
 *
 * Nada disto é público: os avisos de uma pessoa são dela por
 * definição, e a rota não recebe de quem são — lê-os da sessão.
 */
export type EspecieDeAviso =
    | 'market_message'
    | 'forum_reply'
    | 'market_review'
    | 'market_review_reply';

export interface AutorDoAviso {
    id: string;
    username: string;
    avatarUrl: string | null;
}

export interface Aviso {
    id: string;
    kind: EspecieDeAviso;
    /** Nulo quando a conta de quem o causou já saiu. */
    actor: AutorDoAviso | null;
    /** O que se abre. Sai da espécie. */
    openId: string;
    /** Uma linha do que aconteceu — o anúncio, a pergunta. */
    about: string | null;
    excerpt: string | null;
    isRead: boolean;
    createdAt: string;
}

export interface CaixaDeAvisos {
    notifications: Aviso[];
    unread: number;
    page: number;
    pages: number;
    total: number;
}

/**
 * Para onde vai cada espécie.
 *
 * Escrito à mão, como o endereço de um alvo de denúncia: uma espécie
 * nova sem entrada aqui é um erro de compilação, e não uma ligação para
 * lado nenhum.
 */
const ONDE_SE_ABRE: Readonly<Record<EspecieDeAviso, (id: string) => string>> = {
    market_message: (id) => `/mercado/conversas/${id}`,
    forum_reply: (id) => `/forum/${id}`,
    /** A avaliação vive no perfil de quem a recebeu, e a resposta com ela. */
    market_review: (nome) => `/u/${nome}`,
    market_review_reply: (nome) => `/u/${nome}`,
};

export const enderecoDoAviso = (aviso: Aviso): string =>
    ONDE_SE_ABRE[aviso.kind](aviso.openId);

export const listNotifications = (page = 1): Promise<CaixaDeAvisos> =>
    api<CaixaDeAvisos>(`/notifications?page=${page}`);

export const countUnread = (): Promise<{ unread: number }> =>
    api<{ unread: number }>('/notifications/unread');

export const markAllRead = (): Promise<void> =>
    api<void>('/notifications/read', { method: 'POST' });

export const markRead = (notificationId: string): Promise<void> =>
    api<void>(
        `/notifications/${encodeURIComponent(notificationId)}/read`,
        { method: 'POST' },
    );
