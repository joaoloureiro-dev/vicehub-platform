import { AVISOS_POR_PAGINA, EXCERTO_MAXIMO, excertoDe } from '@vicehub/database';

import type { NotificationRepository } from '../repositories/notification.repository.js';
import type { AvisoView } from '../types/notification.types.js';

export interface PaginaDeAvisos {
    avisos: AvisoView[];
    porLer: number;
    pagina: number;
    paginas: number;
    total: number;
}

/**
 * A caixa de avisos de uma pessoa.
 *
 * **Só a dela.** Não há aqui nenhuma rota que devolva os avisos de
 * outra pessoa, e marcar um como lido leva o dono na condição da
 * escrita — não numa leitura antes dela, que é onde cabe a diferença
 * entre o pedido e o efeito.
 */
export class NotificationService {
    constructor(
        private readonly notificationRepository: NotificationRepository,
    ) { }

    async list(userId: string, pagina: number): Promise<PaginaDeAvisos> {
        const [linhas, total, porLer] = await Promise.all([
            this.notificationRepository.list(userId, pagina),
            this.notificationRepository.count(userId),
            this.notificationRepository.countUnread(userId),
        ]);

        return {
            avisos: linhas.map((linha) => ({
                id: linha.id,
                kind: linha.kind,
                actor: linha.actor,
                isRead: linha.read_at !== null,
                createdAt: linha.created_at,
                ...doAlvo(linha),
            })),
            porLer,
            pagina,
            paginas: Math.max(1, Math.ceil(total / AVISOS_POR_PAGINA)),
            total,
        };
    }

    countUnread(userId: string): Promise<number> {
        return this.notificationRepository.countUnread(userId);
    }

    async markAllRead(
        userId: string,
        agora: Date = new Date(),
    ): Promise<void> {
        await this.notificationRepository.markAllRead(userId, agora);
    }

    async markRead(
        notificationId: string,
        userId: string,
        agora: Date = new Date(),
    ): Promise<void> {
        await this.notificationRepository.markRead(
            notificationId,
            userId,
            agora,
        );
    }
}

/**
 * A linha da base de dados, virada no que o ecrã mostra.
 *
 * O `openId` sai da espécie: uma mensagem abre a conversa, uma resposta
 * abre o tópico, uma avaliação abre o perfil de quem a recebeu. O
 * lançamento no fim não é defesa contra o improvável — é o que impede
 * uma espécie nova de aparecer na caixa como uma linha vazia em vez de
 * uma falha que alguém vê.
 */
const doAlvo = (linha: {
    kind: string;
    message: {
        id: string;
        body: string;
        conversationId: string;
        conversation: { listing: { title: string } };
    } | null;
    reply: {
        id: string;
        topicId: string;
        body: string | null;
        topic: { title: string };
    } | null;
    review: {
        id: string;
        rating: number;
        body: string | null;
        reply: string | null;
        subject: { username: string } | null;
        reviewer: { username: string } | null;
        listing: { title: string };
    } | null;
}): Pick<AvisoView, 'openId' | 'about' | 'excerpt'> => {
    if (linha.message !== null) {
        return {
            openId: linha.message.conversationId,
            about: linha.message.conversation.listing.title,
            excerpt: excertoDe(linha.message.body),
        };
    }

    if (linha.reply !== null) {
        return {
            openId: linha.reply.topicId,
            about: linha.reply.topic.title,
            excerpt:
                linha.reply.body === null ? null : excertoDe(linha.reply.body),
        };
    }

    if (linha.review !== null) {
        /**
         * Uma avaliação abre-se no perfil de quem a recebeu — é lá que
         * ela vive. Para a resposta, o mesmo perfil: é lá que a
         * resposta aparece, por baixo da avaliação.
         */
        const perfil = linha.review.subject?.username;

        return {
            openId: perfil ?? '',
            about: linha.review.listing.title,
            excerpt:
                linha.kind === 'market_review_reply'
                    ? linha.review.reply
                    : linha.review.body,
        };
    }

    throw new Error('Aviso sem alvo: o CHECK da tabela devia impedi-lo.');
};

export { EXCERTO_MAXIMO };
