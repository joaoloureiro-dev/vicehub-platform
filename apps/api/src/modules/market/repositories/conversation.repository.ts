import {
    CONVERSAS_POR_PAGINA,
    MENSAGENS_POR_PAGINA,
    type DatabaseClient,
} from '@vicehub/database';

/** O que se lê de quem escreve, e nada mais. */
const PESSOA = {
    select: { id: true, username: true, avatarUrl: true },
} as const;

/**
 * As conversas de um anúncio.
 *
 * **Quem vende não está guardado na conversa**: lê-se do anúncio. Um
 * anúncio tem um vendedor, e guardá-lo outra vez era a mesma verdade em
 * dois sítios à espera de divergir — por isso todas as consultas daqui
 * passam pelo anúncio para saber de quem ele é.
 */
export class ConversationRepository {
    constructor(private readonly database: DatabaseClient) { }

    findListing(listingId: string) {
        return this.database.marketListing.findFirst({
            where: { id: listingId, is_deleted: false },
            select: { id: true, sellerId: true, title: true, serverId: true },
        });
    }

    /**
     * Abre a conversa, ou devolve a que já existe.
     *
     * `upsert` sobre o índice único, e não uma leitura seguida de uma
     * escrita: dois cliques seguidos no mesmo botão cabem entre as duas
     * e abriam duas conversas sobre o mesmo anúncio.
     */
    openConversation(listingId: string, buyerId: string) {
        return this.database.marketConversation.upsert({
            where: { listingId_buyerId: { listingId, buyerId } },
            create: { listingId, buyerId, created_by: buyerId },
            update: {},
            select: { id: true },
        });
    }

    /**
     * A conversa com quem está nela, para se poder decidir quem entra.
     *
     * O vendedor vem do anúncio, pela razão de sempre.
     */
    findConversation(conversationId: string) {
        return this.database.marketConversation.findFirst({
            where: { id: conversationId, is_deleted: false },
            select: {
                id: true,
                buyerId: true,
                buyer: PESSOA,
                listing: {
                    select: {
                        id: true,
                        title: true,
                        price: true,
                        status: true,
                        is_deleted: true,
                        sellerId: true,
                        seller: PESSOA,
                    },
                },
            },
        });
    }

    listMessages(conversationId: string) {
        return this.database.marketMessage.findMany({
            where: { conversationId, is_deleted: false },
            orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
            take: MENSAGENS_POR_PAGINA,
            select: {
                id: true,
                body: true,
                created_at: true,
                senderId: true,
                sender: PESSOA,
            },
        });
    }

    /**
     * Grava a mensagem e toca na conversa, na mesma transação.
     *
     * O toque é o que faz a caixa de entrada ordenar por atividade.
     * Fora da transação, uma mensagem gravada com o toque por dar
     * deixava a conversa no fundo da lista com uma mensagem nova lá
     * dentro — que é o defeito que uma caixa de entrada não pode ter.
     */
    createMessage(input: {
        conversationId: string;
        senderId: string;
        body: string;
    }) {
        return this.database.$transaction(async (tx) => {
            const mensagem = await tx.marketMessage.create({
                data: {
                    conversationId: input.conversationId,
                    senderId: input.senderId,
                    body: input.body,
                    created_by: input.senderId,
                },
                select: { id: true },
            });

            await tx.marketConversation.update({
                where: { id: input.conversationId },
                data: { version: { increment: 1 } },
            });

            return mensagem;
        });
    }

    /**
     * A caixa de entrada de uma pessoa: o que ela perguntou e o que lhe
     * perguntaram, na mesma lista.
     *
     * São dois papéis e uma só lista de propósito. Separá-las obrigava
     * quem vende e compra no mesmo servidor — que são quase todos — a
     * olhar para dois sítios para saber se lhe responderam.
     */
    private onde(userId: string) {
        return {
            is_deleted: false,
            OR: [
                { buyerId: userId },
                { listing: { sellerId: userId } },
            ],
        };
    }

    listConversations(userId: string, pagina: number) {
        return this.database.marketConversation.findMany({
            where: this.onde(userId),
            orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
            skip: (pagina - 1) * CONVERSAS_POR_PAGINA,
            take: CONVERSAS_POR_PAGINA,
            select: {
                id: true,
                updated_at: true,
                buyerId: true,
                buyer: PESSOA,
                listing: {
                    select: {
                        id: true,
                        title: true,
                        price: true,
                        status: true,
                        is_deleted: true,
                        sellerId: true,
                        seller: PESSOA,
                    },
                },
                messages: {
                    where: { is_deleted: false },
                    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
                    take: 1,
                    select: { body: true, created_at: true, senderId: true },
                },
            },
        });
    }

    countConversations(userId: string) {
        return this.database.marketConversation.count({
            where: this.onde(userId),
        });
    }

    /**
     * Retirar uma mensagem é apagar em brando, como em todo o lado: a
     * linha fica e deixa de se ver. E fecha as denúncias que pediam
     * isto, na mesma transação.
     */
    softDeleteMessage(messageId: string, porQuem: string, quando: Date) {
        return this.database.$transaction(async (tx) => {
            const mensagem = await tx.marketMessage.update({
                where: { id: messageId },
                data: {
                    is_deleted: true,
                    deleted_at: quando,
                    updated_by: porQuem,
                    version: { increment: 1 },
                },
                select: { id: true },
            });

            await tx.report.updateMany({
                where: { messageId, status: 'open' },
                data: {
                    status: 'acted',
                    handled_at: quando,
                    handled_by: porQuem,
                    updated_by: porQuem,
                    version: { increment: 1 },
                },
            });

            return mensagem;
        });
    }

    findMessage(messageId: string) {
        return this.database.marketMessage.findFirst({
            where: { id: messageId, is_deleted: false },
            select: {
                id: true,
                senderId: true,
                conversation: {
                    select: {
                        id: true,
                        buyerId: true,
                        listing: { select: { sellerId: true } },
                    },
                },
            },
        });
    }
}
