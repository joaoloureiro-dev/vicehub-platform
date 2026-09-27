import {
    EXCERTO_MAXIMO,
    TOPICOS_POR_PAGINA,
    excertoDe,
} from '@vicehub/database';

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

    async listTopics(
        pagina: number,
        procura?: string,
    ): Promise<PaginaDeTopicos> {
        const [linhas, total] = await Promise.all([
            this.forumRepository.listTopics(pagina, procura),
            this.forumRepository.countTopics(procura),
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
                /*
                 * A lista diz quais já têm resposta escolhida.
                 *
                 * É o que faz a lista valer a pena a quem chega com uma
                 * dúvida: distingue as perguntas que alguém resolveu das
                 * que estão à espera de quem saiba.
                 */
                isAnswered: linha.accepted_reply_id !== null,
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
            askedById: topico.authorId,
            acceptedReplyId: topico.accepted_reply_id,
            /*
             * A aceite vem primeiro, e o resto por ordem de chegada.
             *
             * É a razão de isto existir: quem chega a um tópico com nove
             * respostas seis meses depois não lê nove respostas — lê a
             * primeira e vai-se embora. Deixá-la no meio, com uma marca,
             * resolvia metade do problema e deixava a pior metade de pé.
             */
            replies: [...topico.replies]
                .sort((a, b) =>
                    Number(b.id === topico.accepted_reply_id)
                    - Number(a.id === topico.accepted_reply_id))
                .map((resposta) => ({
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

    /**
     * Fecha ou reabre uma pergunta a respostas novas.
     *
     * É a ferramenta mais branda que um moderador tem: o que lá está
     * continua a servir quem chegar depois de uma pesquisa, e só a
     * conversa é que pára. Retirar apaga a resposta de outra pessoa
     * junto com o desvario, e isso raramente é o que se queria.
     *
     * Quem pode fazê-lo é decidido à porta, pela permissão, e não aqui:
     * ao contrário de retirar, isto **não** é uma coisa que o autor
     * possa fazer ao que é seu. Quem pergunta não é dono da conversa
     * que a resposta dele abriu.
     */
    async setLock(
        topicId: string,
        actorId: string,
        fechar: boolean,
    ): Promise<void> {
        const topico = await this.forumRepository.findTopic(topicId);

        if (topico === null) {
            throw new ForumError(
                'TOPIC_NOT_FOUND',
                'Esta pergunta não existe ou foi retirada.',
            );
        }

        await this.forumRepository.setTopicLock(topicId, actorId, fechar);
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

    /**
     * Marca uma resposta como a que resolveu a pergunta.
     *
     * **Só quem perguntou.** Nem quem modera: a resposta que serviu é um
     * facto de quem tinha o problema, e um moderador a decidi-lo estaria
     * a dizer por ele o que o resolveu. É também por isso que um tópico
     * fechado continua a poder ser marcado — fechar impede respostas
     * novas, e dizer qual delas serviu é exatamente o que se quer fazer
     * a seguir.
     *
     * Aceitar a própria resposta é permitido: quem responde à sua
     * pergunta três dias depois está a fazer ao fórum o melhor favor que
     * há.
     */
    async acceptReply(replyId: string, actorId: string): Promise<void> {
        const resposta = await this.forumRepository.findReplyWithTopic(replyId);

        if (resposta === null || resposta.topic.is_deleted) {
            throw new ForumError(
                'REPLY_NOT_FOUND',
                'Esta resposta não existe ou foi retirada.',
            );
        }

        if (resposta.topic.authorId !== actorId) {
            throw new ForumError(
                'NOT_THE_ASKER',
                'Só quem fez a pergunta pode dizer qual resposta a resolveu.',
            );
        }

        /*
         * Marcar a que já está marcada não faz nada.
         *
         * Sem isto, dois toques no mesmo botão davam dois avisos à mesma
         * pessoa pela mesma coisa — e o segundo não acrescentava nada
         * ao primeiro.
         */
        if (resposta.topic.accepted_reply_id === resposta.id) {
            return;
        }

        await this.forumRepository.acceptReply({
            topicId: resposta.topicId,
            replyId: resposta.id,
            actorId,
        });
    }

    /** Desmarca a resposta aceite. Também só de quem perguntou. */
    async clearAcceptedReply(replyId: string, actorId: string): Promise<void> {
        const resposta = await this.forumRepository.findReplyWithTopic(replyId);

        if (resposta === null || resposta.topic.is_deleted) {
            throw new ForumError(
                'REPLY_NOT_FOUND',
                'Esta resposta não existe ou foi retirada.',
            );
        }

        if (resposta.topic.authorId !== actorId) {
            throw new ForumError(
                'NOT_THE_ASKER',
                'Só quem fez a pergunta pode dizer qual resposta a resolveu.',
            );
        }

        /* Desmarcar outra que não a marcada não mexe em nada. */
        if (resposta.topic.accepted_reply_id !== resposta.id) {
            return;
        }

        await this.forumRepository.clearAcceptedReply(resposta.topicId, actorId);
    }
}

/** Reexportado para quem monta a resposta saber o tamanho do excerto. */
export { EXCERTO_MAXIMO };
