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

/** O que um moderador vê de uma denúncia, na fila. */
export interface ForumReportView {
    id: string;
    reason: string;
    /** O que quem denunciou escreveu, quando escreveu. */
    note: string | null;
    status: string;
    createdAt: Date;
    handledAt: Date | null;
    /** Nulo quando a conta de quem denunciou já saiu. */
    reporter: ForumAuthor | null;
    /**
     * A publicação denunciada, seja ela pergunta ou resposta.
     *
     * Uniformizada de propósito: a fila mostra as duas lado a lado, e
     * dois formatos diferentes obrigavam o ecrã a decidir qual é qual
     * para mostrar a mesma coisa.
     */
    target: {
        kind: 'topic' | 'reply';
        /** Para onde o moderador vai ler o caso completo. */
        topicId: string;
        /** O título, quando o alvo é a pergunta. */
        title: string | null;
        body: string | null;
        author: ForumAuthor | null;
        /** Já retirada — a denúncia ficou, o texto não. */
        isRemoved: boolean;
    };
}
