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

/** O que se pode denunciar. Três espécies, duas superfícies. */
export type EspecieDeAlvo = 'topic' | 'reply' | 'listing';

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
export const enderecoDoAlvo = (alvo: DenunciaNaFila['target']): string =>
    alvo.kind === 'listing'
        ? `/mercado/${alvo.openId}`
        : `/forum/${alvo.openId}`;

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

export const reportListing = (
    listingId: string,
    reason: RazaoDaDenuncia,
    note?: string,
): Promise<{ id: string }> =>
    api<{ id: string }>(`/market/listings/${listingId}/reports`, {
        method: 'POST',
        body: { reason, ...(note ? { note } : {}) },
    });
