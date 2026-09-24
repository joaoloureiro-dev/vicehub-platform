import { api } from '../lib/api.js';

/**
 * A fila de quem modera, uma só para a plataforma inteira.
 *
 * Era do fórum e passou a ser de todos: o mercado abriu, e com ele a
 * plataforma ganhou uma segunda superfície onde qualquer pessoa com
 * conta escreve à vista de toda a gente. Duas filas seriam duas caixas
 * de entrada para o mesmo trabalho, e a segunda ficava por abrir.
 */
export interface Autor {
    id: string;
    username: string;
    avatarUrl: string | null;
}

/**
 * O tecto da nota, dito antes de o pedido sair.
 *
 * A regra a sério é a do servidor. Esta existe para o campo parar onde
 * ele pára, em vez de deixar alguém escrever oitocentos caracteres para
 * depois lhos recusarem.
 */
export const NOTA_MAXIMA = 500;

/**
 * As quatro razões por que se denuncia.
 *
 * Lista fechada e não texto livre: é dela que um moderador decide o que
 * abrir primeiro. O que a pessoa quiser acrescentar vai na nota.
 */
export type RazaoDaDenuncia = 'spam' | 'abuse' | 'off_topic' | 'other';

/**
 * O que se pode denunciar: quatro espécies, três superfícies.
 *
 * Duas delas são públicas — o fórum e o mercado —, e a terceira não: uma
 * conversa é de duas pessoas, e uma mensagem só se denuncia por dentro.
 */
export type EspecieDeAlvo =
    | 'topic'
    | 'reply'
    | 'listing'
    | 'message'
    | 'review';

export interface DenunciaNaFila {
    id: string;
    reason: RazaoDaDenuncia;
    note: string | null;
    status: 'open' | 'acted' | 'dismissed';
    createdAt: string;
    handledAt: string | null;
    reporter: Autor | null;
    target: {
        kind: EspecieDeAlvo;
        /**
         * O que se abre para ver o caso completo.
         *
         * Um campo e não três: quem mostra isto constrói o endereço a
         * partir do `kind`, em vez de adivinhar qual dos três
         * identificadores vinha preenchido.
         */
        openId: string;
        title: string | null;
        body: string | null;
        author: Autor | null;
        isRemoved: boolean;
    };
}

export interface PaginaDeDenuncias {
    reports: DenunciaNaFila[];
    page: number;
    pages: number;
    total: number;
}

/**
 * Para onde o moderador vai ver o caso.
 *
 * A correspondência está escrita à mão de propósito: uma pergunta e uma
 * resposta abrem-se no tópico, um anúncio abre-se no anúncio, e uma
 * espécie nova sem entrada aqui é um erro de compilação em vez de uma
 * ligação para lado nenhum.
 */
const ONDE_SE_ABRE: Readonly<Record<EspecieDeAlvo, (id: string) => string>> = {
    topic: (id) => `/forum/${id}`,
    reply: (id) => `/forum/${id}`,
    listing: (id) => `/mercado/${id}`,
    /**
     * Uma mensagem abre a conversa — e um moderador que não esteja
     * nela leva um "não existe", que é o que a API responde. A
     * ligação existe na mesma: uma das duas pessoas também abre a
     * fila se for ela a moderar, e para essa o caminho é o certo.
     */
    message: (id) => `/mercado/conversas/${id}`,
    /**
     * Uma avaliação abre-se **no anúncio de que fala**: é lá que se vê
     * o caso — o que se vendeu, por quanto, e quem vendeu. A nota e o
     * texto já vêm na própria linha da fila.
     */
    review: (id) => `/mercado/${id}`,
};

export const enderecoDoAlvo = (alvo: DenunciaNaFila['target']): string =>
    ONDE_SE_ABRE[alvo.kind](alvo.openId);

export const listReports = (
    status: 'open' | 'acted' | 'dismissed' = 'open',
    page = 1,
): Promise<PaginaDeDenuncias> =>
    api<PaginaDeDenuncias>(
        `/moderation/reports?status=${status}&page=${page}`,
    );

export const handleReport = (
    reportId: string,
    outcome: 'acted' | 'dismissed',
): Promise<void> =>
    api<void>(`/moderation/reports/${reportId}`, {
        method: 'POST',
        body: { outcome },
    });

export const reportTopic = (
    topicId: string,
    reason: RazaoDaDenuncia,
    note?: string,
): Promise<{ id: string }> =>
    api<{ id: string }>(`/forum/topics/${topicId}/reports`, {
        method: 'POST',
        body: { reason, ...(note ? { note } : {}) },
    });

export const reportReply = (
    replyId: string,
    reason: RazaoDaDenuncia,
    note?: string,
): Promise<{ id: string }> =>
    api<{ id: string }>(`/forum/replies/${replyId}/reports`, {
        method: 'POST',
        body: { reason, ...(note ? { note } : {}) },
    });

export const reportReview = (
    reviewId: string,
    reason: RazaoDaDenuncia,
    note?: string,
): Promise<{ id: string }> =>
    api<{ id: string }>(`/market/reviews/${reviewId}/reports`, {
        method: 'POST',
        body: { reason, ...(note ? { note } : {}) },
    });

export const reportMessage = (
    messageId: string,
    reason: RazaoDaDenuncia,
    note?: string,
): Promise<{ id: string }> =>
    api<{ id: string }>(`/market/messages/${messageId}/reports`, {
        method: 'POST',
        body: { reason, ...(note ? { note } : {}) },
    });

export const reportListing = (
    listingId: string,
    reason: RazaoDaDenuncia,
    note?: string,
): Promise<{ id: string }> =>
    api<{ id: string }>(`/market/listings/${listingId}/reports`, {
        method: 'POST',
        body: { reason, ...(note ? { note } : {}) },
    });
