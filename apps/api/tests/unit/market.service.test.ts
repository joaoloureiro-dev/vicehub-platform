import { describe, expect, it, vi } from 'vitest';

import { MarketError } from '../../src/modules/market/errors/market.errors.js';
import { MarketService } from '../../src/modules/market/services/market.service.js';
import type { MarketRepository } from '../../src/modules/market/repositories/market.repository.js';

/**
 * As regras do mercado que não precisam de base de dados nenhuma.
 *
 * A que mais interessa aqui é a **ordem das recusas**. "Não é teu" vem
 * antes de "já fechou", e não é cosmética: a ordem contrária contava a
 * um estranho em que estado está um anúncio que não lhe diz respeito,
 * e isso é dizer alguma coisa a quem não tinha nada que saber.
 */
const ANUNCIO = {
    id: 'a1',
    category: 'vehicle' as const,
    title: 'Banshee 900R',
    body: 'Pouco uso.',
    price: 250_000n,
    imageUrl: null,
    status: 'open' as const,
    seller: { id: 'u1', username: 'ana', avatarUrl: null },
    sellerId: 'u1' as string | null,
    serverId: 's1',
    server: { name: 'Vice Roleplay' },
    closed_at: null as Date | null,
    created_at: new Date('2026-09-01T10:00:00.000Z'),
    updated_at: new Date('2026-09-02T10:00:00.000Z'),
};

/**
 * O duplo nomeia cada método que existe e recusa-se a inventar os
 * outros, como os duplos da interface: um método esquecido tem de dar
 * erro, e não `undefined`.
 */
const repositorio = (
    porCima: Partial<Record<keyof MarketRepository, unknown>> = {},
) =>
    ({
        listListings: vi.fn(),
        countListings: vi.fn(),
        findListing: vi.fn().mockResolvedValue(ANUNCIO),
        findServer: vi.fn().mockResolvedValue({ id: 's1', name: 'Vice' }),
        userPlaysOnServer: vi.fn().mockResolvedValue(true),
        createListing: vi.fn().mockResolvedValue({ id: 'a1' }),
        updateListing: vi.fn().mockResolvedValue({ id: 'a1' }),
        closeListing: vi.fn().mockResolvedValue({ id: 'a1' }),
        softDeleteListing: vi.fn().mockResolvedValue({ id: 'a1' }),
        ...porCima,
    }) as unknown as MarketRepository;

const codigoDe = async (acto: Promise<unknown>) => {
    try {
        await acto;
    } catch (erro: unknown) {
        return erro instanceof MarketError ? erro.code : 'NÃO É UM MarketError';
    }

    return 'NÃO RECUSOU';
};

describe('o serviço do mercado', () => {
    describe('anunciar', () => {
        it('recusa um servidor que não existe', async () => {
            const servico = new MarketService(
                repositorio({ findServer: vi.fn().mockResolvedValue(null) }),
            );

            expect(
                await codigoDe(
                    servico.createListing('s9', 'u1', {
                        category: 'vehicle',
                        title: 'Banshee',
                        body: 'Pouco uso.',
                        price: 1n,
                    }),
                ),
            ).toBe('SERVER_NOT_FOUND');
        });

        /**
         * A regra que sustenta o mercado inteiro. Sem ela, uma conta
         * feita há dois minutos anunciava em todos os servidores da
         * plataforma ao mesmo tempo.
         */
        it('recusa quem não joga no servidor', async () => {
            const servico = new MarketService(
                repositorio({
                    userPlaysOnServer: vi.fn().mockResolvedValue(false),
                }),
            );

            expect(
                await codigoDe(
                    servico.createListing('s1', 'u9', {
                        category: 'vehicle',
                        title: 'Banshee',
                        body: 'Pouco uso.',
                        price: 1n,
                    }),
                ),
            ).toBe('NOT_ON_SERVER');
        });

        it('guarda a ausência de imagem como ausência, e não por decidir', async () => {
            const repo = repositorio();
            const servico = new MarketService(repo);

            await servico.createListing('s1', 'u1', {
                category: 'vehicle',
                title: 'Banshee',
                body: 'Pouco uso.',
                price: 1n,
            });

            expect(repo.createListing).toHaveBeenCalledWith(
                expect.objectContaining({ imageUrl: null }),
            );
        });
    });

    describe('mexer no que é nosso', () => {
        it.each([
            [
                'editar',
                (s: MarketService) => s.updateListing('a1', 'u2', { price: 1n }),
            ],
            [
                'fechar',
                (s: MarketService) => s.closeListing('a1', 'u2', 'sold'),
            ],
            ['retirar', (s: MarketService) => s.removeListing('a1', 'u2')],
        ])('%s o anúncio de outra pessoa é recusado', async (_nome, acto) => {
            const servico = new MarketService(repositorio());

            expect(await codigoDe(acto(servico))).toBe('NOT_YOURS');
        });

        /**
         * A ordem: primeiro de quem é, e só depois em que estado está.
         * Ao contrário, o estranho ficava a saber que o anúncio já tinha
         * sido vendido.
         */
        it('a um estranho diz que não é dele, e não que já fechou', async () => {
            const servico = new MarketService(
                repositorio({
                    findListing: vi
                        .fn()
                        .mockResolvedValue({ ...ANUNCIO, status: 'sold' }),
                }),
            );

            expect(
                await codigoDe(servico.updateListing('a1', 'u2', { price: 1n })),
            ).toBe('NOT_YOURS');
        });

        it.each(['sold', 'withdrawn'] as const)(
            'não deixa mexer num anúncio %s',
            async (estado) => {
                const servico = new MarketService(
                    repositorio({
                        findListing: vi
                            .fn()
                            .mockResolvedValue({ ...ANUNCIO, status: estado }),
                    }),
                );

                expect(
                    await codigoDe(
                        servico.updateListing('a1', 'u1', { price: 1n }),
                    ),
                ).toBe('ALREADY_CLOSED');
            },
        );

        /**
         * Retirar é a exceção, e de propósito: quem vendeu uma coisa
         * continua a poder tirar do mercado o que escreveu sobre ela.
         */
        it('deixa retirar um anúncio já fechado', async () => {
            const repo = repositorio({
                findListing: vi
                    .fn()
                    .mockResolvedValue({ ...ANUNCIO, status: 'sold' }),
            });

            await new MarketService(repo).removeListing('a1', 'u1');

            expect(repo.softDeleteListing).toHaveBeenCalled();
        });

        it('marca a hora a que o anúncio saiu da venda', async () => {
            const repo = repositorio();
            const quando = new Date('2026-09-23T21:00:00.000Z');

            await new MarketService(repo).closeListing(
                'a1',
                'u1',
                'sold',
                quando,
            );

            expect(repo.closeListing).toHaveBeenCalledWith(
                'a1',
                'u1',
                'sold',
                quando,
            );
        });
    });

    describe('um anúncio de quem já apagou a conta', () => {
        /**
         * O vendedor fica nulo e o anúncio continua a ler-se. O que não
         * pode acontecer é `null === null` dar a qualquer pessoa sem
         * sessão o direito de lhe mexer.
         */
        it('não passa a ser de toda a gente', async () => {
            const servico = new MarketService(
                repositorio({
                    findListing: vi
                        .fn()
                        .mockResolvedValue({ ...ANUNCIO, sellerId: null }),
                }),
            );

            expect(
                await codigoDe(servico.updateListing('a1', 'u1', { price: 1n })),
            ).toBe('NOT_YOURS');
        });
    });
});
