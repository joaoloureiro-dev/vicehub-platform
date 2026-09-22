import {
    DENUNCIAS_POR_PAGINA,
    EXCERTO_MAXIMO,
    TOPICOS_POR_PAGINA,
    excertoDe,
    type ForumReportReason,
    type ForumReportStatus,
} from '@vicehub/database';

import { ForumError } from '../errors/forum.errors.js';
import type { ForumRepository } from '../repositories/forum.repository.js';
import type {
    ForumReportView,
    ForumTopicSummary,
    ForumTopicView,
} from '../types/forum.types.js';

export interface PaginaDeTopicos {
    topicos: ForumTopicSummary[];
    pagina: number;
    paginas: number;
    total: number;
}

export interface PaginaDeDenuncias {
    denuncias: ForumReportView[];
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

    /**
     * Denuncia uma publicação.
     *
     * Existe porque sem ela a moderação dependia de sorte: alguém tinha
     * de calhar de ler a publicação para ela ser vista. Quem lê é quem
     * encontra.
     *
     * Duas recusas, e ambas por razões práticas. **Não se denuncia o que
     * já foi retirado**, porque não há lá nada para um moderador ver. E
     * **não se denuncia o que é nosso** — quem quer o seu texto fora
     * tem o botão de retirar, e uma denúncia a si próprio só põe
     * trabalho na fila de outra pessoa.
     *
     * Denunciar duas vezes a mesma coisa é recusado pela base de dados,
     * e não aqui: entre a leitura e a escrita cabe um segundo clique, e
     * o índice é o único sítio onde isso não cabe.
     */
    async report(
        alvo: { topicId: string } | { replyId: string },
        reporterId: string,
        reason: ForumReportReason,
        note?: string,
    ): Promise<{ id: string }> {
        const publicacao = await this.forumRepository.findReportTarget(alvo);

        if (publicacao === null) {
            throw new ForumError(
                'topicId' in alvo ? 'TOPIC_NOT_FOUND' : 'REPLY_NOT_FOUND',
                'Esta publicação não existe ou foi retirada.',
            );
        }

        if (publicacao.authorId === reporterId) {
            throw new ForumError(
                'IS_YOURS',
                'Isto é teu. Para o tirares daqui, usa o botão de retirar.',
            );
        }

        try {
            return await this.forumRepository.createReport({
                alvo,
                reporterId,
                reason,
                ...(note === undefined ? {} : { note }),
            });
        } catch (erro: unknown) {
            /**
             * O índice único a recusar a segunda denúncia da mesma
             * pessoa à mesma publicação. Não é um erro do ponto de vista
             * de quem carregou no botão: já tinha avisado.
             */
            if (
                erro !== null
                && typeof erro === 'object'
                && (erro as { code?: string }).code === 'P2002'
            ) {
                throw new ForumError(
                    'ALREADY_REPORTED',
                    'Já denunciaste isto. Um moderador vai ver.',
                );
            }

            throw erro;
        }
    }

    /**
     * A fila de quem modera.
     *
     * As mais velhas primeiro, ao contrário do resto da plataforma: uma
     * denúncia por abrir é trabalho, e trabalho velho é o que mais urge.
     */
    async listReports(
        status: ForumReportStatus,
        pagina: number,
    ): Promise<PaginaDeDenuncias> {
        const [linhas, total] = await Promise.all([
            this.forumRepository.listReports(status, pagina),
            this.forumRepository.countReports(status),
        ]);

        return {
            denuncias: linhas.map((linha) => ({
                id: linha.id,
                reason: linha.reason,
                note: linha.note,
                status: linha.status,
                createdAt: linha.created_at,
                handledAt: linha.handled_at,
                reporter: linha.reporter,
                target: linha.topic
                    ? {
                        kind: 'topic' as const,
                        topicId: linha.topic.id,
                        title: linha.topic.title,
                        body: linha.topic.body,
                        author: linha.topic.author,
                        isRemoved: linha.topic.is_deleted,
                    }
                    : {
                        kind: 'reply' as const,
                        /**
                         * O tópico da resposta, e não a resposta: é para
                         * onde o moderador vai ler o caso completo, que
                         * é o que lhe permite decidir.
                         */
                        topicId: (linha.reply as { topicId: string }).topicId,
                        title: null,
                        body: (linha.reply as { body: string | null }).body,
                        author: (linha.reply as { author: null }).author,
                        isRemoved: (linha.reply as { is_deleted: boolean })
                            .is_deleted,
                    },
            })),
            pagina,
            paginas: Math.max(1, Math.ceil(total / DENUNCIAS_POR_PAGINA)),
            total,
        };
    }

    /**
     * Fecha uma denúncia com a conclusão de quem a viu.
     *
     * Fechar uma já fechada é recusado: o segundo moderador estaria a
     * decidir sobre uma coisa que outra pessoa já decidiu, e a sua
     * conclusão apagava a primeira sem que ele soubesse que havia uma.
     */
    async handleReport(
        reportId: string,
        actorId: string,
        outcome: 'acted' | 'dismissed',
    ): Promise<void> {
        const denuncia = await this.forumRepository.findReport(reportId);

        if (denuncia === null) {
            throw new ForumError(
                'REPORT_NOT_FOUND',
                'Esta denúncia não existe.',
            );
        }

        if (denuncia.status !== 'open') {
            throw new ForumError(
                'REPORT_ALREADY_HANDLED',
                'Esta denúncia já foi vista por alguém.',
            );
        }

        await this.forumRepository.handleReport(reportId, outcome, actorId);
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
