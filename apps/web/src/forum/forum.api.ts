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
    /** Se quem perguntou já disse qual resposta resolveu. */
    isAnswered: boolean;
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
    /**
     * Quem perguntou. É a quem o botão de marcar aparece — e a mais
     * ninguém, nem a quem modera.
     */
    askedById: string | null;
    /** A resposta que resolveu, se já houver. Vem sempre em primeiro. */
    acceptedReplyId: string | null;
    replies: ForumReply[];
}

export interface PaginaDeTopicos {
    topics: ForumTopicSummary[];
    page: number;
    pages: number;
    total: number;
}

export const listTopics = (
    page = 1,
    procura = '',
): Promise<PaginaDeTopicos> => {
    const termo = procura.trim();

    return api<PaginaDeTopicos>(
        `/forum/topics?page=${page}`
        + (termo === '' ? '' : `&q=${encodeURIComponent(termo)}`),
    );
};

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
 * Dizer qual resposta resolveu a pergunta, e desdizê-lo.
 *
 * Dois verbos no mesmo caminho, como fechar um tópico: marcar e
 * desmarcar são coisas diferentes, e repetir qualquer uma delas deixa
 * tudo como estava.
 */
export const acceptReply = (replyId: string): Promise<void> =>
    api<void>(`/forum/replies/${encodeURIComponent(replyId)}/accept`, {
        method: 'POST',
    });

export const clearAcceptedReply = (replyId: string): Promise<void> =>
    api<void>(`/forum/replies/${encodeURIComponent(replyId)}/accept`, {
        method: 'DELETE',
    });
