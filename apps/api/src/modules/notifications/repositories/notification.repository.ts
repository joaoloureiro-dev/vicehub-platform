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

    list(userId: string, pagina: number) {
        return this.database.notification.findMany({
            where: { userId },
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
            skip: (pagina - 1) * AVISOS_POR_PAGINA,
            take: AVISOS_POR_PAGINA,
            select: {
                id: true,
                kind: true,
                read_at: true,
                created_at: true,
                actor: ACTOR,
                message: {
                    select: {
                        id: true,
                        body: true,
                        conversationId: true,
                        conversation: {
                            select: { listing: { select: { title: true } } },
                        },
                    },
                },
                reply: {
                    select: { id: true, topicId: true, body: true,
                        topic: { select: { title: true } } },
                },
                review: {
                    select: {
                        id: true,
                        rating: true,
                        body: true,
                        reply: true,
                        subject: { select: { username: true } },
                        reviewer: { select: { username: true } },
                        listing: { select: { title: true } },
                    },
                },
            },
        });
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
