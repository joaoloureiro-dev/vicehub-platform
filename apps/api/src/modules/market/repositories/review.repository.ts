import {
    AVALIACOES_POR_PAGINA,
    type DatabaseClient,
} from '@vicehub/database';

/** O que se lê de quem escreve, e nada mais. */
const PESSOA = {
    select: { id: true, username: true, avatarUrl: true },
} as const;

const AVALIACAO = {
    id: true,
    rating: true,
    body: true,
    reply: true,
    replied_at: true,
    created_at: true,
    reviewerId: true,
    subjectId: true,
    reviewer: PESSOA,
    listing: { select: { id: true, title: true } },
} as const;

export class ReviewRepository {
    constructor(private readonly database: DatabaseClient) { }

    /**
     * O que é preciso saber do anúncio para decidir se se pode avaliar:
     * de quem é, e se chegou a ser vendido.
     */
    findListing(listingId: string) {
        return this.database.marketListing.findFirst({
            where: { id: listingId, is_deleted: false },
            select: { id: true, sellerId: true, status: true },
        });
    }

    /**
     * Houve conversa entre estas duas pessoas sobre este anúncio?
     *
     * É a prova de que um negócio existiu. Não é uma prova perfeita —
     * ninguém pode provar uma entrega dentro de um jogo —, mas é a
     * única que a plataforma tem, e sem ela qualquer pessoa avaliava
     * qualquer outra por ter passado pelo anúncio dela.
     */
    async falaramSobre(
        listingId: string,
        buyerId: string,
    ): Promise<boolean> {
        const conversa = await this.database.marketConversation.findFirst({
            where: { listingId, buyerId, is_deleted: false },
            select: { id: true },
        });

        return conversa !== null;
    }

    createReview(input: {
        listingId: string;
        reviewerId: string;
        subjectId: string;
        rating: number;
        body?: string;
    }) {
        return this.database.marketReview.create({
            data: {
                listingId: input.listingId,
                reviewerId: input.reviewerId,
                subjectId: input.subjectId,
                rating: input.rating,
                ...(input.body === undefined || input.body === ''
                    ? {}
                    : { body: input.body }),
                created_by: input.reviewerId,
            },
            select: { id: true },
        });
    }

    findReview(reviewId: string) {
        return this.database.marketReview.findFirst({
            where: { id: reviewId, is_deleted: false },
            select: AVALIACAO,
        });
    }

    /** A resposta de quem foi avaliado. Uma só — daí o `replied_at`. */
    reply(reviewId: string, subjectId: string, texto: string, quando: Date) {
        return this.database.marketReview.update({
            where: { id: reviewId },
            data: {
                reply: texto,
                replied_at: quando,
                updated_by: subjectId,
                version: { increment: 1 },
            },
            select: { id: true },
        });
    }

    listForUser(subjectId: string, pagina: number) {
        return this.database.marketReview.findMany({
            where: { subjectId, is_deleted: false },
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
            skip: (pagina - 1) * AVALIACOES_POR_PAGINA,
            take: AVALIACOES_POR_PAGINA,
            select: AVALIACAO,
        });
    }

    countForUser(subjectId: string) {
        return this.database.marketReview.count({
            where: { subjectId, is_deleted: false },
        });
    }

    /**
     * As notas de uma pessoa, para a média.
     *
     * Só as notas, e todas: a média é sobre o histórico inteiro e não
     * sobre a página que se está a ver. Guardá-la numa coluna do
     * utilizador seria a mesma verdade em dois sítios — e a que ficasse
     * por actualizar era a que toda a gente lia.
     */
    ratingsForUser(subjectId: string) {
        return this.database.marketReview.findMany({
            where: { subjectId, is_deleted: false },
            select: { rating: true },
        });
    }

    /**
     * Retirar é apagar em brando, e fecha as denúncias que o pediam.
     */
    softDeleteReview(reviewId: string, porQuem: string, quando: Date) {
        return this.database.$transaction(async (tx) => {
            const avaliacao = await tx.marketReview.update({
                where: { id: reviewId },
                data: {
                    is_deleted: true,
                    deleted_at: quando,
                    updated_by: porQuem,
                    version: { increment: 1 },
                },
                select: { id: true },
            });

            await tx.report.updateMany({
                where: { reviewId, status: 'open' },
                data: {
                    status: 'acted',
                    handled_at: quando,
                    handled_by: porQuem,
                    updated_by: porQuem,
                    version: { increment: 1 },
                },
            });

            return avaliacao;
        });
    }
}
