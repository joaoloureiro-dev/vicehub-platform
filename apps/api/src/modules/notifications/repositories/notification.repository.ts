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
     * **Lida em duas metades, e é isso que a faz caber numa caixa
     * vazia.** Pedida de uma vez — a linha com as relações lá dentro —,
     * o Prisma vai buscar cada relação numa instrução própria: a
     * mensagem, a conversa da mensagem, o anúncio da conversa, a
     * resposta, o tópico da resposta, a avaliação e as três coisas
     * dela. Dez instruções, **haja ou não avisos**: uma caixa vazia
     * pagava as dez para não trazer nada.
     *
     * Assim é uma instrução para a página, e depois só as espécies que
     * lá estão mesmo. Quem tem a caixa vazia paga uma; quem tem uma
     * página só de respostas do fórum paga três; as dez só se pagam
     * quando as cinco espécies aparecem todas na mesma página.
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

        /** Os identificadores de uma espécie, sem repetições nem nulos. */
        const idsDe = (
            campo: 'actorId' | 'messageId' | 'replyId' | 'reviewId',
        ): string[] => [
            ...new Set(
                linhas
                    .map((linha) => linha[campo])
                    .filter((id): id is string => id !== null && id !== undefined),
            ),
        ];

        const porId = <T extends { id: string }>(linhas_: T[]): Map<string, T> =>
            new Map(linhas_.map((linha) => [linha.id, linha]));

        const mensagensIds = idsDe('messageId');
        const respostasIds = idsDe('replyId');
        const avaliacoesIds = idsDe('reviewId');

        const [actores, mensagens, respostas, avaliacoes] = await Promise.all([
            this.database.user.findMany({
                where: { id: { in: idsDe('actorId') } },
                ...ACTOR,
            }),

            /*
             * Cada espécie só vai à base se a página a tiver. É a
             * diferença entre uma caixa vazia custar uma instrução ou
             * custar dez.
             */
            mensagensIds.length === 0
                ? []
                : this.database.marketMessage.findMany({
                    where: { id: { in: mensagensIds } },
                    select: {
                        id: true,
                        body: true,
                        conversationId: true,
                        conversation: {
                            select: { listing: { select: { title: true } } },
                        },
                    },
                }),

            respostasIds.length === 0
                ? []
                : this.database.forumReply.findMany({
                    where: { id: { in: respostasIds } },
                    select: {
                        id: true,
                        topicId: true,
                        body: true,
                        topic: { select: { title: true } },
                    },
                }),

            avaliacoesIds.length === 0
                ? []
                : this.database.marketReview.findMany({
                    where: { id: { in: avaliacoesIds } },
                    select: {
                        id: true,
                        rating: true,
                        body: true,
                        reply: true,
                        subject: { select: { username: true } },
                        reviewer: { select: { username: true } },
                        listing: { select: { title: true } },
                    },
                }),
        ]);

        const deActor = porId(actores);
        const deMensagem = porId(mensagens);
        const deResposta = porId(respostas);
        const deAvaliacao = porId(avaliacoes);

        /**
         * E volta a ter a forma de sempre.
         *
         * A ordem é a da página — a das linhas —, e não a de nenhuma
         * das leituras de espécie: uma caixa de avisos fora de ordem
         * não é uma caixa de avisos.
         */
        return linhas.map((linha) => ({
            id: linha.id,
            kind: linha.kind,
            read_at: linha.read_at,
            created_at: linha.created_at,
            actor:
                linha.actorId === null
                    ? null
                    : deActor.get(linha.actorId) ?? null,
            message:
                linha.messageId === null
                    ? null
                    : deMensagem.get(linha.messageId) ?? null,
            reply:
                linha.replyId === null
                    ? null
                    : deResposta.get(linha.replyId) ?? null,
            review:
                linha.reviewId === null
                    ? null
                    : deAvaliacao.get(linha.reviewId) ?? null,
        }));
    }

    count(userId: string) {
        return this.database.notification.count({ where: { userId } });
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
