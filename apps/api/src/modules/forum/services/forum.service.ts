import { EXCERTO_MAXIMO, TOPICOS_POR_PAGINA, excertoDe } from '@vicehub/database';

import { ForumError } from '../errors/forum.errors.js';
import type { ForumRepository } from '../repositories/forum.repository.js';
import type {
    ForumTopicSummary,
    ForumTopicView,
} from '../types/forum.types.js';

export interface PaginaDeTopicos {
    topicos: ForumTopicSummary[];
    pagina: number;
    paginas: number;
    total: number;
}

/**
 * O fórum.
 *
 * Ler não pede sessão: uma pergunta respondida vale para quem chega de
 * uma pesquisa, e fechá-la atrás de um registo faria a plataforma
 * responder à mesma pergunta vezes sem conta.
 *
 * Escrever pede. E retirar o que se escreveu é de duas pessoas: de quem
 * o escreveu, sempre, e de quem modera.
 */
export class ForumService {
    constructor(private readonly forumRepository: ForumRepository) { }

    async listTopics(pagina: number): Promise<PaginaDeTopicos> {
        const [linhas, total] = await Promise.all([
            this.forumRepository.listTopics(pagina),
            this.forumRepository.countTopics(),
        ]);

        return {
            topicos: linhas.map((linha) => ({
                id: linha.id,
                title: linha.title,
                /**
                 * A lista mostra o princípio da pergunta, não a pergunta
                 * toda: um tópico com oito mil caracteres empurrava os
                 * outros todos para fora do ecrã.
                 */
                excerpt: linha.body === null ? null : excertoDe(linha.body),
                author: linha.author,
                replyCount: linha._count.replies,
                isLocked: linha.locked_at !== null,
                createdAt: linha.created_at,
                lastActivityAt: linha.updated_at,
            })),
            pagina,
            paginas: Math.max(1, Math.ceil(total / TOPICOS_POR_PAGINA)),
            total,
        };
    }

    async getTopic(topicId: string): Promise<ForumTopicView> {
        const topico = await this.forumRepository.findTopic(topicId);

        if (topico === null) {
            throw new ForumError(
                'TOPIC_NOT_FOUND',
                'Esta pergunta não existe ou foi retirada.',
            );
        }

        return {
            id: topico.id,
            title: topico.title,
            body: topico.body,
            author: topico.author,
            isLocked: topico.locked_at !== null,
            createdAt: topico.created_at,
            replies: topico.replies.map((resposta) => ({
                id: resposta.id,
                body: resposta.body,
                author: resposta.author,
                createdAt: resposta.created_at,
            })),
        };
    }

    async createTopic(
        input: { title: string; body: string },
        authorId: string,
    ): Promise<{ id: string }> {
        return this.forumRepository.createTopic({ ...input, authorId });
    }

    async reply(
        topicId: string,
        body: string,
        authorId: string,
    ): Promise<{ id: string }> {
        const topico = await this.forumRepository.findTopic(topicId);

        if (topico === null) {
            throw new ForumError(
                'TOPIC_NOT_FOUND',
                'Esta pergunta não existe ou foi retirada.',
            );
        }

        /**
         * Um tópico fechado não recebe mais nada. É o que um moderador
         * usa quando a conversa deixou de ser sobre a pergunta — e é
         * mais brando do que retirá-la, porque o que lá está continua a
         * servir quem chegar depois.
         */
        if (topico.locked_at !== null) {
            throw new ForumError(
                'TOPIC_LOCKED',
                'Esta pergunta foi fechada a respostas novas.',
            );
        }

        return this.forumRepository.createReply({ topicId, authorId, body });
    }

    /**
     * Retira um tópico.
     *
     * Quem o escreveu pode sempre. Quem modera também, e é a permissão
     * que decide isso — chega aqui já apurada, porque quem sabe se
     * alguém a tem é a camada de autorização e não este serviço.
     */
    async removeTopic(
        topicId: string,
        actorId: string,
        podeModerar: boolean,
    ): Promise<void> {
        const topico = await this.forumRepository.findTopic(topicId);

        if (topico === null) {
            throw new ForumError(
                'TOPIC_NOT_FOUND',
                'Esta pergunta não existe ou foi retirada.',
            );
        }

        if (!podeModerar && topico.authorId !== actorId) {
            throw new ForumError(
                'NOT_YOURS',
                'Só quem escreveu esta pergunta a pode retirar.',
            );
        }

        await this.forumRepository.removeTopic(topicId, actorId);
    }

    async removeReply(
        replyId: string,
        actorId: string,
        podeModerar: boolean,
    ): Promise<void> {
        const resposta = await this.forumRepository.findReply(replyId);

        if (resposta === null) {
            throw new ForumError(
                'REPLY_NOT_FOUND',
                'Esta resposta não existe ou foi retirada.',
            );
        }

        if (!podeModerar && resposta.authorId !== actorId) {
            throw new ForumError(
                'NOT_YOURS',
                'Só quem escreveu esta resposta a pode retirar.',
            );
        }

        await this.forumRepository.removeReply(replyId, actorId);
    }
}

/** Reexportado para quem monta a resposta saber o tamanho do excerto. */
export { EXCERTO_MAXIMO };
