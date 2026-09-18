/** Quem escreveu, como aparece a quem lê. */
export interface ForumAuthor {
    id: string;
    username: string;
    avatarUrl: string | null;
}

export interface ForumTopicSummary {
    id: string;
    title: string;
    /** Nulo quando o texto foi retirado com a conta de quem o escreveu. */
    excerpt: string | null;
    author: ForumAuthor | null;
    replyCount: number;
    isLocked: boolean;
    createdAt: Date;
    lastActivityAt: Date;
}

export interface ForumReplyView {
    id: string;
    body: string | null;
    author: ForumAuthor | null;
    createdAt: Date;
}

export interface ForumTopicView {
    id: string;
    title: string;
    body: string | null;
    author: ForumAuthor | null;
    isLocked: boolean;
    createdAt: Date;
    replies: ForumReplyView[];
}
