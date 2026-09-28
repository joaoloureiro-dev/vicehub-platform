import {
    RESPOSTAS_POR_PAGINA,
    TOPICOS_POR_PAGINA,
    type CategoriaDoForum,
    type DatabaseClient,
} from '@vicehub/database';

import { colunaDoAlvo, type Alvo } from '../../moderation/repositories/report.repository.js';
import { NotificationRepository } from '../../notifications/repositories/notification.repository.js';

/** A transação em curso, tal como no resto da plataforma. */
type Escritor = Parameters<
    Parameters<DatabaseClient['$transaction']>[0] extends (tx: infer T) => unknown
        ? (tx: T) => void
        : never
>[0];

/** O que se lê de quem escreveu, e nada mais. */
const AUTOR = {
    select: { id: true, username: true, avatarUrl: true },
} as const;

/**
 * O que se procura, em título e corpo.
 *
 * `contains` e não pesquisa de texto do Postgres, de propósito. É o
 * mesmo mecanismo do diretório de crews e do de servidores — uma
 * plataforma com três caixas de procura não deve ter três maneiras de
 * procurar —, e a esta escala faz o que é preciso: quem escreve
 * "corrida" encontra "corridas", que uma pesquisa de texto sem
 * radicalização não encontrava.
 *
 * **O que não faz**, e é para saber antes de fazer falta: não ordena por
 * relevância nenhuma — o que encontra sai pela última atividade, como o
 * resto da lista, por isso um tópico com a palavra no título não vem à
 * frente de um que a tem a meio do corpo — e casa no meio das palavras,
 * por isso "arte" também aparece em "cartas". No dia em que o fórum
 * tiver milhares de tópicos,
 * isto passa a ser um índice de texto a sério, com a língua de cada
 * tópico guardada ao lado dele para o radicalizador saber o que está a
 * ler. Hoje seria maquinaria a mais para o problema que existe.
 */
const filtroDeProcura = (procura: string | undefined) =>
    procura === undefined
        ? {}
        : {
            OR: [
                { title: { contains: procura, mode: 'insensitive' as const } },
                { body: { contains: procura, mode: 'insensitive' as const } },
            ],
        };

/**
 * Em que parte do fórum procurar, ou no fórum todo.
 *
 * Escrito uma vez e usado pela lista e pela contagem, pela mesma razão
 * que o filtro da procura: uma lista e uma contagem com filtros
 * diferentes dizem «página 1 de 9» por cima de três resultados.
 */
const filtroDeCategoria = (categoria: CategoriaDoForum | undefined) =>
    categoria === undefined ? {} : { category: categoria };

export class ForumRepository {
    constructor(private readonly database: DatabaseClient) { }

    listTopics(
        pagina: number,
        procura?: string,
        categoria?: CategoriaDoForum,
    ) {
        return this.database.forumTopic.findMany({
            where: {
                is_deleted: false,
                ...filtroDeProcura(procura),
                ...filtroDeCategoria(categoria),
            },
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
                category: true,
                locked_at: true,
                accepted_reply_id: true,
                created_at: true,
                updated_at: true,
                author: AUTOR,
                _count: { select: { replies: { where: { is_deleted: false } } } },
            },
        });
    }

    countTopics(procura?: string, categoria?: CategoriaDoForum) {
        /*
         * Conta com o mesmo filtro da lista.
         *
         * Sem isto, uma procura devolvia três tópicos e dizia «página 1
         * de 9» — o número de páginas saía do fórum inteiro, e quem
         * carregasse na 2 via uma lista vazia sem perceber porquê.
         */
        return this.database.forumTopic.count({
            where: {
                is_deleted: false,
                ...filtroDeProcura(procura),
                ...filtroDeCategoria(categoria),
            },
        });
    }

    findTopic(topicId: string) {
        return this.database.forumTopic.findFirst({
            where: { id: topicId, is_deleted: false },
            select: {
                id: true,
                title: true,
                body: true,
                category: true,
                authorId: true,
                locked_at: true,
                accepted_reply_id: true,
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

    createTopic(input: {
        authorId: string;
        title: string;
        body: string;
        category: CategoriaDoForum;
    }) {
        return this.database.forumTopic.create({
            data: {
                authorId: input.authorId,
                title: input.title,
                body: input.body,
                category: input.category,
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

            const topico = await tx.forumTopic.update({
                where: { id: input.topicId },
                data: { version: { increment: 1 } },
                select: { authorId: true },
            });

            /**
             * E avisa quem perguntou, na mesma transação.
             *
             * Quem responde à sua própria pergunta não se avisa, e uma
             * pergunta de uma conta já apagada não avisa ninguém.
             */
            if (
                topico.authorId !== null
                && topico.authorId !== input.authorId
            ) {
                await NotificationRepository.criar(tx, {
                    userId: topico.authorId,
                    kind: 'forum_reply',
                    actorId: input.authorId,
                    replyId: resposta.id,
                });
            }

            return resposta;
        });
    }

    findReply(replyId: string) {
        return this.database.forumReply.findFirst({
            where: { id: replyId, is_deleted: false },
            select: { id: true, authorId: true },
        });
    }

    /** A resposta, com o tópico a que pertence e quem o abriu. */
    findReplyWithTopic(replyId: string) {
        return this.database.forumReply.findFirst({
            where: { id: replyId, is_deleted: false },
            select: {
                id: true,
                authorId: true,
                topicId: true,
                topic: {
                    select: {
                        id: true,
                        authorId: true,
                        is_deleted: true,
                        accepted_reply_id: true,
                    },
                },
            },
        });
    }

    /**
     * Marca uma resposta como a que resolveu, e avisa quem a escreveu.
     *
     * O apontador está no tópico, por isso marcar outra desmarca a
     * anterior sem ninguém ter de o fazer: não há um instante em que
     * duas estejam aceites.
     *
     * O aviso nasce na mesma transação, como todos os outros. Quem
     * aceita a sua própria resposta não se avisa a si mesmo, e uma
     * resposta de uma conta que já saiu não avisa ninguém.
     */
    acceptReply(input: { topicId: string; replyId: string; actorId: string }) {
        return this.database.$transaction(async (tx) => {
            await tx.forumTopic.update({
                where: { id: input.topicId },
                data: {
                    accepted_reply_id: input.replyId,
                    updated_by: input.actorId,
                    version: { increment: 1 },
                },
                select: { id: true },
            });

            const resposta = await tx.forumReply.findFirstOrThrow({
                where: { id: input.replyId },
                select: { authorId: true },
            });

            if (
                resposta.authorId !== null
                && resposta.authorId !== input.actorId
            ) {
                await NotificationRepository.criar(tx, {
                    userId: resposta.authorId,
                    kind: 'forum_accepted',
                    actorId: input.actorId,
                    replyId: input.replyId,
                });
            }
        });
    }

    /**
     * Desmarca.
     *
     * Sem aviso nenhum: dizer a alguém que a resposta dele deixou de ser
     * a escolhida é uma má notícia que ninguém pediu para receber, e
     * quem perguntou tem o direito de mudar de ideias sem que isso seja
     * um acontecimento.
     */
    clearAcceptedReply(topicId: string, actorId: string) {
        return this.database.forumTopic.update({
            where: { id: topicId },
            data: {
                accepted_reply_id: null,
                updated_by: actorId,
                version: { increment: 1 },
            },
            select: { id: true },
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
        return this.database.$transaction(async (tx) => {
            const topico = await tx.forumTopic.update({
                where: { id: topicId },
                data: {
                    is_deleted: true,
                    deleted_at: new Date(),
                    updated_by: actorId,
                    version: { increment: 1 },
                },
                select: { id: true },
            });

            await this.fecharDenuncias(tx, { kind: 'topic', id: topicId }, actorId);

            return topico;
        });
    }

    /**
     * Fecha ou reabre um tópico a respostas novas.
     *
     * Uma data e não uma marca: saber **quando** foi fechado é o que
     * permite a um moderador explicar-se mais tarde, e é a diferença
     * entre um registo e um interruptor.
     *
     * Escrever o mesmo estado duas vezes não é erro. Dois moderadores a
     * fechar a mesma conversa ao mesmo tempo é o caso normal de uma
     * discussão a aquecer, e a segunda gravação apenas confirma a
     * primeira.
     */
    setTopicLock(topicId: string, actorId: string, fechar: boolean) {
        return this.database.forumTopic.update({
            where: { id: topicId },
            data: {
                locked_at: fechar ? new Date() : null,
                updated_by: actorId,
                version: { increment: 1 },
            },
            select: { id: true },
        });
    }

    /**
     * Retira uma resposta e fecha as denúncias que havia sobre ela.
     *
     * Na mesma transação, e pela mesma razão do toque no tópico: fora
     * dela, uma denúncia sobre texto já retirado ficava na fila à espera
     * de um moderador que não tem nada para ver.
     */
    removeReply(replyId: string, actorId: string) {
        return this.database.$transaction(async (tx) => {
            const resposta = await tx.forumReply.update({
                where: { id: replyId },
                data: {
                    is_deleted: true,
                    deleted_at: new Date(),
                    updated_by: actorId,
                    version: { increment: 1 },
                },
                select: { id: true },
            });

            await this.fecharDenuncias(tx, { kind: 'reply', id: replyId }, actorId);

            /*
             * E deixa de ser a resposta aceite, se era.
             *
             * O `ON DELETE SET NULL` da base só trata do apagar a sério,
             * e aqui o apagar é brando: a linha fica, com `is_deleted`.
             * Sem isto, o tópico continuava a apontar para uma resposta
             * retirada — e o ecrã mostrava uma marca de "resolvido" por
             * cima de um buraco.
             */
            await tx.forumTopic.updateMany({
                where: { accepted_reply_id: replyId },
                data: { accepted_reply_id: null, updated_by: actorId },
            });

            return resposta;
        });
    }

    /**
     * Fecha como tratadas as denúncias abertas sobre uma publicação.
     *
     * Chamada de dentro das retiradas, e não à parte: quem retira já
     * agiu, e a denúncia que pedia isso está respondida. Deixá-la aberta
     * mandava o moderador seguinte olhar para texto que já não existe.
     */
    private fecharDenuncias(tx: Escritor, alvo: Alvo, actorId: string) {
        return tx.report.updateMany({
            where: { ...colunaDoAlvo(alvo), status: 'open' },
            data: {
                status: 'acted',
                handled_at: new Date(),
                handled_by: actorId,
                updated_by: actorId,
                version: { increment: 1 },
            },
        });
    }
}
