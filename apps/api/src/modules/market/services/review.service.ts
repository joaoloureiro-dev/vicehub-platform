import {
    AVALIACOES_POR_PAGINA,
    mediaDasAvaliacoes,
} from '@vicehub/database';

import { MarketError } from '../errors/market.errors.js';
import type { ReviewRepository } from '../repositories/review.repository.js';
import type { AvaliacaoView, ResumoDeAvaliacoes } from '../types/market.types.js';

export interface PaginaDeAvaliacoes {
    avaliacoes: AvaliacaoView[];
    resumo: ResumoDeAvaliacoes;
    pagina: number;
    paginas: number;
    total: number;
}

/**
 * As avaliações de uma venda.
 *
 * **Amarradas a um negócio que existiu**, e é a decisão que faz isto
 * valer alguma coisa. Avaliações abertas a quem quiser são um sistema
 * de vinganças com outro nome: chega uma discussão no fórum para
 * alguém ir estragar a média de outra pessoa.
 *
 * Três condições, todas verificadas:
 *
 * - **o anúncio foi vendido** — quem não vendeu nada não tem o que
 *   avaliar;
 * - **houve conversa** entre quem avalia e quem vendeu, sobre aquele
 *   anúncio, que é a única prova de um negócio que a plataforma tem;
 * - **uma avaliação por venda e por pessoa**, garantida pelo índice.
 *
 * São **públicas**, e por isso denunciam-se como qualquer outra coisa
 * que se escreve à vista de todos.
 */
export class ReviewService {
    constructor(private readonly reviewRepository: ReviewRepository) { }

    async createReview(
        listingId: string,
        reviewerId: string,
        rating: number,
        body?: string,
    ): Promise<{ id: string }> {
        const anuncio = await this.reviewRepository.findListing(listingId);

        if (anuncio === null) {
            throw new MarketError(
                'LISTING_NOT_FOUND',
                'Este anúncio não existe ou foi retirado.',
            );
        }

        if (anuncio.sellerId === reviewerId) {
            throw new MarketError(
                'IS_YOURS',
                'Este anúncio é teu. Quem avalia é quem comprou.',
            );
        }

        if (anuncio.sellerId === null) {
            throw new MarketError(
                'SELLER_GONE',
                'Quem anunciou isto já não tem conta.',
            );
        }

        /**
         * Vendido, e não fechado de qualquer maneira: um anúncio
         * retirado não teve negócio nenhum, e deixar avaliar um dava a
         * quem desiste de vender uma estrela por desistir.
         */
        if (anuncio.status !== 'sold') {
            throw new MarketError(
                'NOT_SOLD',
                'Só se avalia uma venda que aconteceu.',
            );
        }

        const falaram = await this.reviewRepository.falaramSobre(
            listingId,
            reviewerId,
        );

        if (!falaram) {
            throw new MarketError(
                'NO_DEAL',
                'Só avalia quem falou com quem vendeu sobre este anúncio.',
            );
        }

        try {
            return await this.reviewRepository.createReview({
                listingId,
                reviewerId,
                subjectId: anuncio.sellerId,
                rating,
                ...(body === undefined ? {} : { body }),
            });
        } catch (erro: unknown) {
            if (
                erro !== null
                && typeof erro === 'object'
                && (erro as { code?: string }).code === 'P2002'
            ) {
                throw new MarketError(
                    'ALREADY_REVIEWED',
                    'Já avaliaste esta venda.',
                );
            }

            throw erro;
        }
    }

    /**
     * A resposta de quem foi avaliado.
     *
     * Uma só, e de quem recebeu a avaliação. Uma avaliação injusta sem
     * direito de resposta é um problema a sério; uma discussão por
     * baixo de cada estrela é outro, e a resposta única é o meio-termo.
     */
    async reply(
        reviewId: string,
        subjectId: string,
        texto: string,
        agora: Date = new Date(),
    ): Promise<{ id: string }> {
        const avaliacao = await this.reviewRepository.findReview(reviewId);

        if (avaliacao === null) {
            throw new MarketError(
                'REVIEW_NOT_FOUND',
                'Esta avaliação não existe ou foi retirada.',
            );
        }

        if (avaliacao.subjectId !== subjectId) {
            throw new MarketError(
                'NOT_YOURS',
                'Só quem foi avaliado pode responder.',
            );
        }

        if (avaliacao.reply !== null) {
            throw new MarketError(
                'ALREADY_REPLIED',
                'Já respondeste a esta avaliação.',
            );
        }

        return this.reviewRepository.reply(reviewId, subjectId, texto, agora);
    }

    async listForUser(
        subjectId: string,
        pagina: number,
    ): Promise<PaginaDeAvaliacoes> {
        const [linhas, total, notas] = await Promise.all([
            this.reviewRepository.listForUser(subjectId, pagina),
            this.reviewRepository.countForUser(subjectId),
            this.reviewRepository.ratingsForUser(subjectId),
        ]);

        return {
            avaliacoes: linhas.map((linha) => ({
                id: linha.id,
                rating: linha.rating,
                body: linha.body,
                reply: linha.reply,
                repliedAt: linha.replied_at,
                reviewer: linha.reviewer,
                listing: linha.listing,
                createdAt: linha.created_at,
            })),
            resumo: {
                average: mediaDasAvaliacoes(
                    notas.map((linha) => linha.rating),
                ),
                count: notas.length,
            },
            pagina,
            paginas: Math.max(1, Math.ceil(total / AVALIACOES_POR_PAGINA)),
            total,
        };
    }

    /**
     * Retirar uma avaliação.
     *
     * De quem a escreveu, sempre — mudou de ideias, ou escreveu com
     * raiva — e de quem modera, que é o que dá consequência a uma
     * denúncia. **Nunca de quem foi avaliado**: apagar a nota que se
     * recebeu era ter uma média que só diz o que o dono dela quer.
     */
    async removeReview(
        reviewId: string,
        userId: string,
        podeModerar = false,
        agora: Date = new Date(),
    ): Promise<void> {
        const avaliacao = await this.reviewRepository.findReview(reviewId);

        if (avaliacao === null) {
            throw new MarketError(
                'REVIEW_NOT_FOUND',
                'Esta avaliação não existe ou foi retirada.',
            );
        }

        if (!podeModerar && avaliacao.reviewerId !== userId) {
            throw new MarketError(
                'NOT_YOURS',
                'Só quem escreveu esta avaliação a pode retirar.',
            );
        }

        await this.reviewRepository.softDeleteReview(reviewId, userId, agora);
    }
}
