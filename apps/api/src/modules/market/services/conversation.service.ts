import { CONVERSAS_POR_PAGINA } from '@vicehub/database';

import { MarketError } from '../errors/market.errors.js';
import type { ConversationRepository } from '../repositories/conversation.repository.js';
import type {
    ConversaResumo,
    ConversaView,
} from '../types/market.types.js';

export interface PaginaDeConversas {
    conversas: ConversaResumo[];
    pagina: number;
    paginas: number;
    total: number;
}

/**
 * A conversa sobre um anúncio.
 *
 * É a peça que faltava para o mercado servir para alguma coisa: um
 * anúncio diz "entrego no parque do porto" e alguém tem de poder
 * perguntar a que horas. Sem isto a conversa acontecia toda no Discord,
 * e o mercado era um placard.
 *
 * **É privada.** Só as duas pessoas a leem: quem anunciou e quem
 * perguntou. Não há aqui nenhuma rota que devolva uma conversa a quem
 * não está nela, e a única maneira de um moderador ver o que lá se
 * escreveu é uma das duas denunciar uma mensagem — e ele vê **essa
 * mensagem**, e não a conversa.
 */
export class ConversationService {
    constructor(
        private readonly conversationRepository: ConversationRepository,
    ) { }

    /**
     * Abrir uma conversa sobre um anúncio.
     *
     * Duas recusas. **Não se fala com um anúncio retirado**, porque do
     * outro lado já não há nada a combinar. E **não se fala consigo
     * próprio**: quem anunciou não precisa de se perguntar nada, e a
     * conversa consigo seria uma linha na caixa de entrada a não
     * significar nada.
     */
    async openConversation(
        listingId: string,
        buyerId: string,
    ): Promise<{ id: string }> {
        const anuncio = await this.conversationRepository.findListing(
            listingId,
        );

        if (anuncio === null) {
            throw new MarketError(
                'LISTING_NOT_FOUND',
                'Este anúncio não existe ou foi retirado.',
            );
        }

        if (anuncio.sellerId === buyerId) {
            throw new MarketError(
                'IS_YOURS',
                'Este anúncio é teu. Quem pergunta é quem o lê.',
            );
        }

        return this.conversationRepository.openConversation(
            listingId,
            buyerId,
        );
    }

    /**
     * A conversa, se quem pede estiver nela.
     *
     * A recusa de quem não está é a mesma de uma conversa que não
     * existe, de propósito: dizer "existe mas não é contigo" já contava
     * que duas pessoas estão a falar sobre aquele anúncio.
     */
    async getConversation(
        conversationId: string,
        userId: string,
    ): Promise<ConversaView> {
        const conversa = await this.conversationRepository.findConversation(
            conversationId,
        );

        if (conversa === null || !estaNaConversa(conversa, userId)) {
            throw new MarketError(
                'CONVERSATION_NOT_FOUND',
                'Esta conversa não existe.',
            );
        }

        const mensagens = await this.conversationRepository.listMessages(
            conversationId,
        );

        return {
            id: conversa.id,
            listing: {
                id: conversa.listing.id,
                title: conversa.listing.title,
                price: conversa.listing.price,
                status: conversa.listing.status,
                isRemoved: conversa.listing.is_deleted,
            },
            buyer: conversa.buyer,
            seller: conversa.listing.seller,
            messages: mensagens.map((mensagem) => ({
                id: mensagem.id,
                body: mensagem.body,
                sender: mensagem.sender,
                isMine: mensagem.senderId === userId,
                createdAt: mensagem.created_at,
            })),
        };
    }

    /**
     * Escrever.
     *
     * Só quem está na conversa, e só enquanto o anúncio existir. Um
     * anúncio retirado por um moderador não pode continuar a ter uma
     * conversa aberta por baixo: era retirar o anúncio e deixar o
     * problema a falar.
     */
    async sendMessage(
        conversationId: string,
        senderId: string,
        body: string,
    ): Promise<{ id: string }> {
        const conversa = await this.conversationRepository.findConversation(
            conversationId,
        );

        if (conversa === null || !estaNaConversa(conversa, senderId)) {
            throw new MarketError(
                'CONVERSATION_NOT_FOUND',
                'Esta conversa não existe.',
            );
        }

        if (conversa.listing.is_deleted) {
            throw new MarketError(
                'LISTING_NOT_FOUND',
                'Este anúncio foi retirado.',
            );
        }

        return this.conversationRepository.createMessage({
            conversationId,
            senderId,
            body,
        });
    }

    async listConversations(
        userId: string,
        pagina: number,
    ): Promise<PaginaDeConversas> {
        const [linhas, total] = await Promise.all([
            this.conversationRepository.listConversations(userId, pagina),
            this.conversationRepository.countConversations(userId),
        ]);

        return {
            conversas: linhas.map((linha) => {
                const ultima = linha.messages[0];

                return {
                    id: linha.id,
                    listing: {
                        id: linha.listing.id,
                        title: linha.listing.title,
                        price: linha.listing.price,
                        status: linha.listing.status,
                        isRemoved: linha.listing.is_deleted,
                    },
                    /**
                     * Quem está do outro lado, do ponto de vista de
                     * quem pede. Uma caixa de entrada que mostrasse
                     * sempre o mesmo nome obrigava a pessoa a abrir
                     * cada linha para saber com quem estava a falar.
                     */
                    comQuem:
                        linha.buyerId === userId
                            ? linha.listing.seller
                            : linha.buyer,
                    ultima:
                        ultima === undefined
                            ? null
                            : {
                                body: ultima.body,
                                isMine: ultima.senderId === userId,
                                createdAt: ultima.created_at,
                            },
                    updatedAt: linha.updated_at,
                };
            }),
            pagina,
            paginas: Math.max(1, Math.ceil(total / CONVERSAS_POR_PAGINA)),
            total,
        };
    }

    /**
     * Retirar uma mensagem.
     *
     * De quem a escreveu, sempre — e de quem modera, que é como uma
     * denúncia deixa de ser um aviso sem consequência. Ao contrário das
     * outras superfícies, ninguém mais a vê de qualquer maneira: o que
     * isto tira é o que a outra pessoa da conversa continua a ler.
     */
    async removeMessage(
        messageId: string,
        userId: string,
        podeModerar = false,
        agora: Date = new Date(),
    ): Promise<void> {
        const mensagem = await this.conversationRepository.findMessage(
            messageId,
        );

        if (mensagem === null) {
            throw new MarketError(
                'MESSAGE_NOT_FOUND',
                'Esta mensagem não existe ou já foi retirada.',
            );
        }

        const minha = mensagem.senderId === userId;

        if (!podeModerar && !minha) {
            throw new MarketError(
                'NOT_YOURS',
                'Esta mensagem não é tua.',
            );
        }

        await this.conversationRepository.softDeleteMessage(
            messageId,
            userId,
            agora,
        );
    }
}

/**
 * Se esta pessoa é uma das duas da conversa.
 *
 * Escrito uma vez e usado em todas as entradas. Três cópias desta
 * comparação eram três sítios onde uma delas podia ficar para trás — e
 * a que ficasse para trás era uma porta aberta para a correspondência
 * de duas pessoas.
 */
const estaNaConversa = (
    conversa: { buyerId: string | null; listing: { sellerId: string | null } },
    userId: string,
): boolean =>
    conversa.buyerId === userId || conversa.listing.sellerId === userId;
