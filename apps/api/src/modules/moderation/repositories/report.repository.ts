import {
    DENUNCIAS_POR_PAGINA,
    type AlvoDeDenuncia,
    type DatabaseClient,
    type ReportReason,
    type ReportStatus,
} from '@vicehub/database';

/** O que se lê de quem escreveu, e nada mais. */
const AUTOR = {
    select: { id: true, username: true, avatarUrl: true },
} as const;

/**
 * Onde é que cada espécie de alvo vive.
 *
 * Um sítio só a dizer qual é a coluna e qual é a tabela de cada alvo. A
 * alternativa era um `if` por cada operação — criar, procurar, fechar —
 * e três cópias da mesma correspondência a divergirem à quarta espécie.
 */
export type Alvo = { kind: AlvoDeDenuncia; id: string };

const COLUNA: Readonly<Record<AlvoDeDenuncia, 'topicId' | 'replyId' | 'listingId'>> = {
    topic: 'topicId',
    reply: 'replyId',
    listing: 'listingId',
};

/** A coluna do alvo, preenchida, para um `where` ou um `create`. */
export const colunaDoAlvo = (alvo: Alvo): Record<string, string> => ({
    [COLUNA[alvo.kind]]: alvo.id,
});

export class ReportRepository {
    constructor(private readonly database: DatabaseClient) { }

    /**
     * O que foi denunciado ainda lá está, e de quem é?
     *
     * As três leituras devolvem a mesma forma — existe e o autor — para
     * que quem decide não tenha de saber de que tabela veio.
     */
    async findTarget(
        alvo: Alvo,
    ): Promise<{ id: string; authorId: string | null } | null> {
        if (alvo.kind === 'topic') {
            return this.database.forumTopic.findFirst({
                where: { id: alvo.id, is_deleted: false },
                select: { id: true, authorId: true },
            });
        }

        if (alvo.kind === 'reply') {
            return this.database.forumReply.findFirst({
                where: { id: alvo.id, is_deleted: false },
                select: { id: true, authorId: true },
            });
        }

        const anuncio = await this.database.marketListing.findFirst({
            where: { id: alvo.id, is_deleted: false },
            select: { id: true, sellerId: true },
        });

        return anuncio === null
            ? null
            : { id: anuncio.id, authorId: anuncio.sellerId };
    }

    createReport(input: {
        alvo: Alvo;
        reporterId: string;
        reason: ReportReason;
        note?: string;
    }) {
        return this.database.report.create({
            data: {
                ...colunaDoAlvo(input.alvo),
                reporterId: input.reporterId,
                reason: input.reason,
                ...(input.note === undefined || input.note === ''
                    ? {}
                    : { note: input.note }),
                created_by: input.reporterId,
            },
            select: { id: true },
        });
    }

    /**
     * A fila de quem modera.
     *
     * As mais velhas primeiro, ao contrário de tudo o resto na
     * plataforma: uma denúncia por abrir é trabalho, e trabalho velho é
     * o que mais urge. Ordenar pela mais recente deixava a primeira
     * denúncia do dia a ser sempre a última a ser vista.
     */
    listReports(status: ReportStatus, pagina: number) {
        return this.database.report.findMany({
            where: { status },
            orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
            skip: (pagina - 1) * DENUNCIAS_POR_PAGINA,
            take: DENUNCIAS_POR_PAGINA,
            select: {
                id: true,
                reason: true,
                note: true,
                status: true,
                created_at: true,
                handled_at: true,
                reporter: AUTOR,
                topic: {
                    select: {
                        id: true,
                        title: true,
                        body: true,
                        is_deleted: true,
                        author: AUTOR,
                    },
                },
                reply: {
                    select: {
                        id: true,
                        topicId: true,
                        body: true,
                        is_deleted: true,
                        author: AUTOR,
                    },
                },
                listing: {
                    select: {
                        id: true,
                        title: true,
                        body: true,
                        is_deleted: true,
                        seller: AUTOR,
                    },
                },
            },
        });
    }

    countReports(status: ReportStatus) {
        return this.database.report.count({ where: { status } });
    }

    findReport(reportId: string) {
        return this.database.report.findUnique({
            where: { id: reportId },
            select: { id: true, status: true },
        });
    }

    handleReport(
        reportId: string,
        outcome: 'acted' | 'dismissed',
        actorId: string,
    ) {
        return this.database.report.update({
            where: { id: reportId },
            data: {
                status: outcome,
                handled_at: new Date(),
                handled_by: actorId,
                updated_by: actorId,
                version: { increment: 1 },
            },
            select: { id: true },
        });
    }
}
