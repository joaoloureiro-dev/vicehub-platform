import { api } from '../lib/api.js';

export interface ForumAuthor {
    id: string;
    username: string;
    avatarUrl: string | null;
}

export interface ForumTopicSummary {
    id: string;
    title: string;
    /** Nulo quando o texto saiu com a conta de quem o escreveu. */
    excerpt: string | null;
    author: ForumAuthor | null;
    replyCount: number;
    isLocked: boolean;
    createdAt: string;
    lastActivityAt: string;
}

export interface ForumReply {
    id: string;
    body: string | null;
    author: ForumAuthor | null;
    createdAt: string;
}

export interface ForumTopic {
    id: string;
    title: string;
    body: string | null;
    author: ForumAuthor | null;
    isLocked: boolean;
    createdAt: string;
    replies: ForumReply[];
}

export interface PaginaDeTopicos {
    topics: ForumTopicSummary[];
    page: number;
    pages: number;
    total: number;
}

export const listTopics = (page = 1): Promise<PaginaDeTopicos> =>
    api<PaginaDeTopicos>(`/forum/topics?page=${page}`);

export const getTopic = (topicId: string): Promise<ForumTopic> =>
    api<ForumTopic>(`/forum/topics/${topicId}`);

export const createTopic = (input: {
    title: string;
    body: string;
}): Promise<{ id: string }> =>
    api<{ id: string }>('/forum/topics', { method: 'POST', body: input });

export const replyToTopic = (
    topicId: string,
    body: string,
): Promise<{ id: string }> =>
    api<{ id: string }>(`/forum/topics/${topicId}/replies`, {
        method: 'POST',
        body: { body },
    });

/**
 * Se quem está com sessão aberta modera o fórum.
 *
 * Perguntado à parte da leitura do tópico, porque ler não pede sessão:
 * um campo na resposta pública obrigava a autenticar quem chega de uma
 * pesquisa só para lhe dizer que não modera.
 */
export const podeModerar = (): Promise<{ canModerate: boolean }> =>
    api<{ canModerate: boolean }>('/forum/moderation');

export const lockTopic = (topicId: string): Promise<void> =>
    api<void>(`/forum/topics/${topicId}/lock`, { method: 'POST' });

export const unlockTopic = (topicId: string): Promise<void> =>
    api<void>(`/forum/topics/${topicId}/lock`, { method: 'DELETE' });

export const removeTopic = (topicId: string): Promise<void> =>
    api<void>(`/forum/topics/${topicId}`, { method: 'DELETE' });

export const removeReply = (replyId: string): Promise<void> =>
    api<void>(`/forum/replies/${replyId}`, { method: 'DELETE' });

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

export interface DenunciaNaFila {
    id: string;
    reason: RazaoDaDenuncia;
    note: string | null;
    status: 'open' | 'acted' | 'dismissed';
    createdAt: string;
    handledAt: string | null;
    reporter: ForumAuthor | null;
    target: {
        kind: 'topic' | 'reply';
        topicId: string;
        title: string | null;
        body: string | null;
        author: ForumAuthor | null;
        isRemoved: boolean;
    };
}

export interface PaginaDeDenuncias {
    reports: DenunciaNaFila[];
    page: number;
    pages: number;
    total: number;
}

export const listReports = (
    status: 'open' | 'acted' | 'dismissed' = 'open',
    page = 1,
): Promise<PaginaDeDenuncias> =>
    api<PaginaDeDenuncias>(`/forum/reports?status=${status}&page=${page}`);

export const handleReport = (
    reportId: string,
    outcome: 'acted' | 'dismissed',
): Promise<void> =>
    api<void>(`/forum/reports/${reportId}`, {
        method: 'POST',
        body: { outcome },
    });
