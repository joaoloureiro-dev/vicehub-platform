import {
    AVISOS_POR_PAGINA,
    type DatabaseClient,
    type EspecieDeAviso,
} from '@vicehub/database';

/** Quem causou, e nada mais. */
const ACTOR = {
    select: { id: true, username: true, avatarUrl: true },
} as const;

/**
 * A transação em curso, tal como no resto da plataforma.
 *
 * Os avisos nascem **dentro** da transação de quem os causa, e não a
 * seguir: um aviso escrito fora dela perde-se quando a escrita seguinte
 * falha, e o que se perde é a única coisa que dizia à pessoa que havia
 * ali alguma coisa.
 */
type Escritor = Parameters<
    Parameters<DatabaseClient['$transaction']>[0] extends (tx: infer T) => unknown
        ? (tx: T) => void
        : never
>[0];

export interface AvisoNovo {
    userId: string;
    kind: EspecieDeAviso;
    actorId: string;
    messageId?: string;
    replyId?: string;
    reviewId?: string;
}

export class NotificationRepository {
    constructor(private readonly database: DatabaseClient) { }

    /**
     * Grava um aviso dentro de uma transação de outra pessoa.
     *
     * Estático na prática — recebe o escritor em vez de o ir buscar —
     * porque quem o chama já está dentro de uma transação e abrir outra
     * era o mesmo que escrever fora dela.
     */
    static async criar(tx: Escritor, aviso: AvisoNovo): Promise<void> {
        await tx.notification.create({
            data: {
                userId: aviso.userId,
                kind: aviso.kind,
                actorId: aviso.actorId,
                ...(aviso.messageId === undefined
                    ? {}
                    : { messageId: aviso.messageId }),
                ...(aviso.replyId === undefined
                    ? {}
                    : { replyId: aviso.replyId }),
                ...(aviso.reviewId === undefined
                    ? {}
                    : { reviewId: aviso.reviewId }),
                created_by: aviso.actorId,
            },
            select: { id: true },
        });
    }

    /**
     * Uma página de avisos, com o que cada um aponta.
     *
     * **Cada tabela lida uma vez, e só as que a página precisa.**
     *
     * Pedida de uma vez — a linha com as relações lá dentro —, o Prisma
     * vai buscar cada relação numa instrução própria, e vai buscar a
     * mesma tabela tantas vezes quantas ela aparecer: os utilizadores
     * três vezes (quem causou o aviso, quem foi avaliado, quem
     * avaliou), os anúncios duas (o da conversa e o da avaliação).
     * Catorze instruções para uma página, **e dez delas mesmo com a
     * caixa vazia**.
     *
     * Aqui a página vem primeiro e as tabelas depois, cada uma uma vez
     * só e nenhuma sem ter a quem servir. Uma caixa vazia custa uma
     * instrução; uma página só de respostas do fórum custa três; as
     * oito só se pagam quando lá estão as quatro famílias de alvo ao
     * mesmo tempo.
     *
     * O que sai daqui tem a forma de sempre — cada aviso com o seu
     * alvo lá dentro —, para que quem o lê não tenha de saber nada
     * disto.
     */
    async list(userId: string, pagina: number) {
        const linhas = await this.database.notification.findMany({
            where: { userId },
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
            skip: (pagina - 1) * AVISOS_POR_PAGINA,
            take: AVISOS_POR_PAGINA,
            select: {
                id: true,
                kind: true,
                read_at: true,
                created_at: true,
                actorId: true,
                messageId: true,
                replyId: true,
                reviewId: true,
            },
        });

        if (linhas.length === 0) {
            return [];
        }

        /** Os identificadores de um campo, sem repetições nem nulos. */
        const idsDe = <T>(
            de: readonly T[],
            campo: (linha: T) => string | null | undefined,
        ): string[] => [
            ...new Set(
                de
                    .map(campo)
                    .filter((id): id is string => id !== null && id !== undefined),
            ),
        ];

        const porId = <T extends { id: string }>(
            lidas: readonly T[],
        ): Map<string, T> => new Map(lidas.map((linha) => [linha.id, linha]));

        /** Uma leitura que não se faz quando não há a quem servir. */
        const seHouver = async <T>(
            ids: readonly string[],
            ler: (ids: readonly string[]) => Promise<T[]>,
        ): Promise<T[]> => (ids.length === 0 ? [] : ler(ids));

        const [mensagens, respostas, avaliacoes] = await Promise.all([
            seHouver(idsDe(linhas, (l) => l.messageId), (ids) =>
                this.database.marketMessage.findMany({
                    where: { id: { in: [...ids] } },
                    select: { id: true, body: true, conversationId: true },
                })),

            seHouver(idsDe(linhas, (l) => l.replyId), (ids) =>
                this.database.forumReply.findMany({
                    where: { id: { in: [...ids] } },
                    select: { id: true, topicId: true, body: true },
                })),

            /*
             * Sem o `rating` e sem quem avaliou: a caixa não mostra
             * nem um nem outro. Eram duas colunas e **uma ida à tabela
             * dos utilizadores** em cada página, para nada.
             */
            seHouver(idsDe(linhas, (l) => l.reviewId), (ids) =>
                this.database.marketReview.findMany({
                    where: { id: { in: [...ids] } },
                    select: {
                        id: true,
                        body: true,
                        reply: true,
                        listingId: true,
                        subjectId: true,
                    },
                })),
        ]);

        /*
         * Quem causou o aviso e quem foi avaliado saem da mesma tabela,
         * e por isso saem da mesma leitura.
         */
        const pessoasIds = [
            ...new Set([
                ...idsDe(linhas, (l) => l.actorId),
                ...idsDe(avaliacoes, (a) => a.subjectId),
            ]),
        ];

        const [conversas, topicos, pessoas] = await Promise.all([
            seHouver(idsDe(mensagens, (m) => m.conversationId), (ids) =>
                this.database.marketConversation.findMany({
                    where: { id: { in: [...ids] } },
                    select: { id: true, listingId: true },
                })),

            seHouver(idsDe(respostas, (r) => r.topicId), (ids) =>
                this.database.forumTopic.findMany({
                    where: { id: { in: [...ids] } },
                    select: { id: true, title: true },
                })),

            seHouver(pessoasIds, (ids) =>
                this.database.user.findMany({
                    where: { id: { in: [...ids] } },
                    ...ACTOR,
                })),
        ]);

        /*
         * E o anúncio da conversa e o da avaliação são o mesmo sítio:
         * uma leitura para os dois.
         */
        const anuncios = await seHouver(
            [
                ...new Set([
                    ...idsDe(conversas, (c) => c.listingId),
                    ...idsDe(avaliacoes, (a) => a.listingId),
                ]),
            ],
            (ids) =>
                this.database.marketListing.findMany({
                    where: { id: { in: [...ids] } },
                    select: { id: true, title: true },
                }),
        );

        const dePessoa = porId(pessoas);
        const deMensagem = porId(mensagens);
        const deResposta = porId(respostas);
        const deAvaliacao = porId(avaliacoes);
        const deConversa = porId(conversas);
        const deTopico = porId(topicos);
        const deAnuncio = porId(anuncios);

        /** O título de um anúncio, ou vazio se ele já não existir. */
        const titulo = (listingId: string | null): string =>
            (listingId === null ? undefined : deAnuncio.get(listingId)?.title)
            ?? '';

        /**
         * E volta a ter a forma de sempre.
         *
         * A ordem é a da página — a das linhas —, e não a de nenhuma
         * das leituras: uma caixa de avisos fora de ordem não é uma
         * caixa de avisos.
         */
        return linhas.map((linha) => {
            const mensagem =
                linha.messageId === null
                    ? null
                    : deMensagem.get(linha.messageId) ?? null;

            const resposta =
                linha.replyId === null
                    ? null
                    : deResposta.get(linha.replyId) ?? null;

            const avaliacao =
                linha.reviewId === null
                    ? null
                    : deAvaliacao.get(linha.reviewId) ?? null;

            return {
                id: linha.id,
                kind: linha.kind,
                read_at: linha.read_at,
                created_at: linha.created_at,

                actor:
                    linha.actorId === null
                        ? null
                        : dePessoa.get(linha.actorId) ?? null,

                message:
                    mensagem === null
                        ? null
                        : {
                            id: mensagem.id,
                            body: mensagem.body,
                            conversationId: mensagem.conversationId,
                            conversation: {
                                listing: {
                                    title: titulo(
                                        deConversa.get(mensagem.conversationId)
                                            ?.listingId ?? null,
                                    ),
                                },
                            },
                        },

                reply:
                    resposta === null
                        ? null
                        : {
                            id: resposta.id,
                            topicId: resposta.topicId,
                            body: resposta.body,
                            topic: {
                                title: deTopico.get(resposta.topicId)?.title ?? '',
                            },
                        },

                review:
                    avaliacao === null
                        ? null
                        : {
                            id: avaliacao.id,
                            body: avaliacao.body,
                            reply: avaliacao.reply,
                            subject:
                                avaliacao.subjectId === null
                                    ? null
                                    : dePessoa.get(avaliacao.subjectId) ?? null,
                            listing: { title: titulo(avaliacao.listingId) },
                        },
            };
        });
    }

    /**
     * Quantos avisos há, e quantos por ler — numa consulta.
     *
     * Eram duas: uma contava tudo e outra contava os que estão por ler.
     * Contar a coluna `read_at` conta as linhas em que ela não é nula —
     * os lidos —, e os por ler são a diferença. Uma instrução em vez de
     * duas, e as duas contagens a falar do mesmo instante: com duas
     * leituras, um aviso que chegasse entre elas dava uma caixa com
     * mais por ler do que avisos.
     */
    async contagens(userId: string): Promise<{ total: number; porLer: number }> {
        const contagem = await this.database.notification.aggregate({
            where: { userId },
            _count: { _all: true, read_at: true },
        });

        const total = contagem._count._all;

        return { total, porLer: total - contagem._count.read_at };
    }

    /** O que está por ler, que é o número que a barra mostra. */
    countUnread(userId: string) {
        return this.database.notification.count({
            where: { userId, read_at: null },
        });
    }

    /**
     * Dá por lidos os que estão por ler.
     *
     * `updateMany` com a condição de estarem por ler, e não um `update`
     * por linha: marcar trezentos avisos um a um é trezentas escritas
     * para uma acção que a pessoa fez uma vez.
     */
    markAllRead(userId: string, quando: Date) {
        return this.database.notification.updateMany({
            where: { userId, read_at: null },
            data: { read_at: quando, updated_by: userId },
        });
    }

    /**
     * Dá um por lido — e só se for de quem pede.
     *
     * A condição do dono vai no `where` e não numa leitura antes: assim
     * não há caminho em que o aviso de outra pessoa mude de estado.
     */
    markRead(notificationId: string, userId: string, quando: Date) {
        return this.database.notification.updateMany({
            where: { id: notificationId, userId, read_at: null },
            data: { read_at: quando, updated_by: userId },
        });
    }
}
