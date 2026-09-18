import {
    RESPOSTAS_POR_PAGINA,
    TOPICOS_POR_PAGINA,
    type DatabaseClient,
} from '@vicehub/database';

/** O que se lê de quem escreveu, e nada mais. */
const AUTOR = {
    select: { id: true, username: true, avatarUrl: true },
} as const;

export class ForumRepository {
    constructor(private readonly database: DatabaseClient) { }

    listTopics(pagina: number) {
        return this.database.forumTopic.findMany({
            where: { is_deleted: false },
            /**
             * Pela última atividade, e não pela criação: um tópico com
             * uma resposta de agora interessa mais do que um aberto
             * ontem e esquecido. O `updated_at` acompanha as respostas
             * porque quem responde toca no tópico.
             */
            orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
            skip: (pagina - 1) * TOPICOS_POR_PAGINA,
            take: TOPICOS_POR_PAGINA,
            select: {
                id: true,
                title: true,
                body: true,
                locked_at: true,
                created_at: true,
                updated_at: true,
                author: AUTOR,
                _count: { select: { replies: { where: { is_deleted: false } } } },
            },
        });
    }

    countTopics() {
        return this.database.forumTopic.count({ where: { is_deleted: false } });
    }

    findTopic(topicId: string) {
        return this.database.forumTopic.findFirst({
            where: { id: topicId, is_deleted: false },
            select: {
                id: true,
                title: true,
                body: true,
                authorId: true,
                locked_at: true,
                created_at: true,
                author: AUTOR,
                replies: {
                    where: { is_deleted: false },
                    orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
                    take: RESPOSTAS_POR_PAGINA,
                    select: {
                        id: true,
                        body: true,
                        created_at: true,
                        author: AUTOR,
                    },
                },
            },
        });
    }

    createTopic(input: { authorId: string; title: string; body: string }) {
        return this.database.forumTopic.create({
            data: {
                authorId: input.authorId,
                title: input.title,
                body: input.body,
                created_by: input.authorId,
            },
            select: { id: true },
        });
    }

    /**
     * Grava a resposta e toca no tópico, na mesma transação.
     *
     * O toque é o que faz a lista ordenar por atividade. Fora da
     * transação, uma resposta gravada com o toque por dar deixava o
     * tópico no fundo da lista com uma resposta nova lá dentro.
     */
    createReply(input: { topicId: string; authorId: string; body: string }) {
        return this.database.$transaction(async (tx) => {
            const resposta = await tx.forumReply.create({
                data: {
                    topicId: input.topicId,
                    authorId: input.authorId,
                    body: input.body,
                    created_by: input.authorId,
                },
                select: { id: true },
            });

            await tx.forumTopic.update({
                where: { id: input.topicId },
                data: { version: { increment: 1 } },
            });

            return resposta;
        });
    }

    findReply(replyId: string) {
        return this.database.forumReply.findFirst({
            where: { id: replyId, is_deleted: false },
            select: { id: true, authorId: true },
        });
    }

    /**
     * Retira um tópico.
     *
     * Marcado como apagado, e não apagado: as respostas de outras
     * pessoas ficam, e o registo de que houve ali uma pergunta é o que
     * permite a um moderador explicar-se mais tarde.
     */
    removeTopic(topicId: string, actorId: string) {
        return this.database.forumTopic.update({
            where: { id: topicId },
            data: {
                is_deleted: true,
                deleted_at: new Date(),
                updated_by: actorId,
                version: { increment: 1 },
            },
            select: { id: true },
        });
    }

    removeReply(replyId: string, actorId: string) {
        return this.database.forumReply.update({
            where: { id: replyId },
            data: {
                is_deleted: true,
                deleted_at: new Date(),
                updated_by: actorId,
                version: { increment: 1 },
            },
            select: { id: true },
        });
    }
}
