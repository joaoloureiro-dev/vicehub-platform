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

export const removeTopic = (topicId: string): Promise<void> =>
    api<void>(`/forum/topics/${topicId}`, { method: 'DELETE' });

export const removeReply = (replyId: string): Promise<void> =>
    api<void>(`/forum/replies/${replyId}`, { method: 'DELETE' });
