import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';

import { toStripePeriod } from '../../src/modules/billing/services/stripe.gateway.js';

/**
 * A tradução do que o Stripe diz para o que a plataforma guarda.
 *
 * É a fronteira onde o dinheiro entra. O que aqui se lê mal fica
 * gravado mal, e ninguém dá por isso até alguém comparar a fatura com o
 * que a plataforma diz ter cobrado.
 */
const subscricao = (
    overrides: Record<string, unknown> = {},
    item: Record<string, unknown> = {},
): Stripe.Subscription =>
    ({
        id: 'sub_1',
        customer: 'cus_1',
        status: 'active',
        cancel_at_period_end: false,
        items: {
            data: [
                {
                    current_period_start: 1_767_225_600,
                    current_period_end: 1_769_904_000,
                    price: {
                        id: 'price_server_plus',
                        unit_amount: 1_999,
                        currency: 'eur',
                    },
                    ...item,
                },
            ],
        },
        ...overrides,
    }) as unknown as Stripe.Subscription;

describe('ler uma subscrição do Stripe', () => {
    /**
     * **É por este identificador que se sabe que plano isto é.**
     *
     * Sem ele, o webhook não tem como distinguir um servidor sem limite
     * de uma crew, e grava o mesmo plano para os dois — que foi
     * exatamente o que se fazia quando havia um preço só.
     */
    it('traz o identificador do preço que está a ser cobrado', () => {
        expect(toStripePeriod(subscricao()).priceId).toBe('price_server_plus');
    });

    /**
     * O que se grava é o que foi mesmo cobrado, e não o preço do
     * catálogo: o histórico tem de continuar exato depois de uma
     * alteração de preços.
     */
    it('traz o valor e a moeda da linha, e não os nossos', () => {
        expect(toStripePeriod(subscricao())).toMatchObject({
            priceCents: 1_999,
            currency: 'EUR',
        });
    });

    /**
     * O período vive na linha da subscrição, e não na subscrição:
     * desde que o Stripe passou a permitir linhas com ciclos
     * diferentes, é aí que as datas estão.
     */
    it('lê as datas da linha, em segundos', () => {
        const periodo = toStripePeriod(subscricao());

        expect(periodo.currentPeriodStart.toISOString()).toBe(
            '2026-01-01T00:00:00.000Z',
        );
        expect(periodo.currentPeriodEnd.toISOString()).toBe(
            '2026-02-01T00:00:00.000Z',
        );
    });

    it('aceita o cliente como objeto ou como identificador', () => {
        expect(toStripePeriod(subscricao()).customerId).toBe('cus_1');
        expect(
            toStripePeriod(subscricao({ customer: { id: 'cus_2' } })).customerId,
        ).toBe('cus_2');
    });

    /**
     * Uma subscrição sem linhas não tem preço nem período. Aceitá-la
     * gravaria um plano a zero euros com datas inventadas.
     */
    it('recusa uma subscrição sem linhas', () => {
        expect(() =>
            toStripePeriod(subscricao({ items: { data: [] } })),
        ).toThrowError(expect.objectContaining({ code: 'STRIPE_REQUEST_FAILED' }));
    });
});

/**
 * A sessão de pagamento que se pede ao Stripe.
 *
 * O que aqui se prova é uma linha só, e é a linha que decide quanto é
 * que a pessoa paga: **o preço que vai na sessão é o do plano pedido**.
 * Enquanto havia um preço configurado só, esta linha mandava sempre o
 * mesmo — um servidor que comprasse o escalão sem limite pagava o preço
 * de uma crew.
 */
describe('pedir uma sessão de pagamento', () => {
    const create = vi.fn().mockResolvedValue({ url: 'https://checkout.test/x' });

    beforeEach(() => {
        create.mockClear();
        vi.resetModules();

        vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_1');
        vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_1');
        vi.stubEnv('STRIPE_PRICE_PREMIUM', 'price_crew');
        vi.stubEnv('STRIPE_SUCCESS_URL', 'https://vicehub.test/ok');
        vi.stubEnv('STRIPE_CANCEL_URL', 'https://vicehub.test/nao');

        vi.doMock('stripe', () => {
            class Fake {
                checkout = { sessions: { create } };

                static errors = { StripeError: class extends Error {} };
            }

            return { default: Fake };
        });
    });

    const pedir = async (priceId: string) => {
        const { createStripeGateway } = await import(
            '../../src/modules/billing/services/stripe.gateway.js'
        );

        await createStripeGateway()?.createCheckoutSession({
            ownerKind: 'server',
            ownerId: 'server-1',
            buyerId: 'user-1',
            buyerEmail: 'dono@vicehub.test',
            priceId,
        });

        return create.mock.calls[0]?.[0] as {
            line_items: { price: string }[];
        };
    };

    it.each(['price_crew', 'price_server_plus', 'price_server_unlimited'])(
        'cobra %s quando é esse o preço do plano',
        async (priceId) => {
            expect((await pedir(priceId)).line_items).toEqual([
                { price: priceId, quantity: 1 },
            ]);
        },
    );
});
