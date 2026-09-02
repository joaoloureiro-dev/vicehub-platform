import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';

import { BillingError } from '../../src/modules/billing/errors/billing.errors.js';
import { BillingService } from '../../src/modules/billing/services/billing.service.js';
import type { BillingRepository } from '../../src/modules/billing/repositories/billing.repository.js';
import type {
    StripeGateway,
    StripePeriod,
} from '../../src/modules/billing/services/stripe.gateway.js';

const periodo = (overrides: Partial<StripePeriod> = {}): StripePeriod => ({
    subscriptionId: 'sub_stripe_1',
    customerId: 'cus_1',
    status: 'active',
    currentPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    priceCents: 1_000,
    currency: 'USD',
    ...overrides,
});

/**
 * Um evento com a forma que o Stripe lhe dá, reduzido ao que o serviço
 * lê. Basta isto: o serviço nunca confia no corpo do evento para saber
 * o estado, vai perguntá-lo.
 */
const evento = (
    type: string,
    object: Record<string, unknown> = {},
    id = 'evt_1',
): Stripe.Event =>
    ({ id, type, data: { object } }) as unknown as Stripe.Event;

const createRepositoryMock = () => ({
    claimEvent: vi.fn().mockResolvedValue(true),
    markEventProcessed: vi.fn().mockResolvedValue(undefined),
    upsertPeriod: vi.fn().mockResolvedValue({ id: 'sub-1' }),
    findByProviderSubscriptionId: vi.fn().mockResolvedValue(null),
    findCustomerId: vi.fn().mockResolvedValue(null),
    hasPerpetualAccess: vi.fn().mockResolvedValue(false),
    ownerExists: vi.fn().mockResolvedValue(true),
    findUserEmail: vi.fn().mockResolvedValue({ email: 'player@vicehub.test' }),
});

const createGatewayMock = () => ({
    createCheckoutSession: vi
        .fn()
        .mockResolvedValue({ url: 'https://checkout.stripe.com/x' }),
    constructEvent: vi.fn(),
    readSubscription: vi.fn().mockResolvedValue(periodo()),
    cancelAtPeriodEnd: vi.fn().mockResolvedValue(undefined),
});

describe('BillingService', () => {
    let repository: ReturnType<typeof createRepositoryMock>;
    let gateway: ReturnType<typeof createGatewayMock>;
    let service: BillingService;

    const compra = {
        ownerKind: 'user' as const,
        ownerId: '11111111-1111-4111-8111-111111111111',
        buyerId: '22222222-2222-4222-8222-222222222222',
    };

    beforeEach(() => {
        repository = createRepositoryMock();
        gateway = createGatewayMock();

        service = new BillingService(
            repository as unknown as BillingRepository,
            gateway as unknown as StripeGateway,
        );
    });

    const expectBillingError = async (promise: Promise<unknown>, code: string) => {
        const error = await promise.catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(BillingError);
        expect((error as BillingError).code).toBe(code);
    };

    describe('sem Stripe configurado', () => {
        /**
         * Sem chaves a plataforma funciona toda menos a compra pelo
         * próprio. Dizê-lo claramente é melhor do que um erro de uma
         * biblioteca sem configuração.
         */
        it('recusa a compra em vez de rebentar', async () => {
            const semStripe = new BillingService(
                repository as unknown as BillingRepository,
                null,
            );

            await expectBillingError(
                semStripe.startCheckout(compra),
                'BILLING_NOT_CONFIGURED',
            );
        });

        it('recusa também o webhook', () => {
            const semStripe = new BillingService(
                repository as unknown as BillingRepository,
                null,
            );

            expect(() =>
                semStripe.verifyEvent(Buffer.from('{}'), 'assinatura'),
            ).toThrow(BillingError);
        });
    });

    describe('começar uma compra', () => {
        it('leva o titular nos metadados, para o webhook o saber depois', async () => {
            await service.startCheckout({
                ...compra,
                ownerKind: 'crew',
                ownerId: '33333333-3333-4333-8333-333333333333',
            });

            expect(gateway.createCheckoutSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    ownerKind: 'crew',
                    ownerId: '33333333-3333-4333-8333-333333333333',
                    buyerId: compra.buyerId,
                }),
            );
        });

        it('recusa um titular que não existe', async () => {
            repository.ownerExists.mockResolvedValue(false);

            await expectBillingError(
                service.startCheckout(compra),
                'BILLING_OWNER_NOT_FOUND',
            );

            expect(gateway.createCheckoutSession).not.toHaveBeenCalled();
        });

        /**
         * Receber dinheiro por uma coisa que já foi oferecida é a
         * espécie de erro que ninguém repara e toda a gente acha mal.
         */
        it('não deixa um vitalício começar a pagar', async () => {
            repository.hasPerpetualAccess.mockResolvedValue(true);

            await expectBillingError(
                service.startCheckout(compra),
                'ALREADY_LIFETIME',
            );

            expect(gateway.createCheckoutSession).not.toHaveBeenCalled();
        });

        /**
         * Sem reaproveitar o cliente, a mesma crew acabava com vários
         * clientes na conta do Stripe, cada um com o seu histórico de
         * faturas.
         */
        it('reaproveita o cliente de quem já comprou antes', async () => {
            repository.findCustomerId.mockResolvedValue('cus_existente');

            await service.startCheckout(compra);

            expect(gateway.createCheckoutSession).toHaveBeenCalledWith(
                expect.objectContaining({ customerId: 'cus_existente' }),
            );
        });

        it('não inventa um cliente quando é a primeira compra', async () => {
            await service.startCheckout(compra);

            const pedido = gateway.createCheckoutSession.mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;

            expect('customerId' in pedido).toBe(false);
        });
    });

    describe('aplicar um evento', () => {
        const completado = () =>
            evento('checkout.session.completed', {
                subscription: 'sub_stripe_1',
                metadata: { ownerKind: 'user', ownerId: compra.ownerId },
            });

        it('grava o período tal como o Stripe o descreve', async () => {
            await expect(service.applyEvent(completado())).resolves.toBe('applied');

            expect(repository.upsertPeriod).toHaveBeenCalledWith(
                expect.objectContaining({
                    owner: { userId: compra.ownerId },
                    providerSubscriptionId: 'sub_stripe_1',
                    providerCustomerId: 'cus_1',
                    status: 'active',
                    priceCents: 1_000,
                    periodStart: new Date('2026-09-01T00:00:00.000Z'),
                    periodEnd: new Date('2026-10-01T00:00:00.000Z'),
                }),
            );
        });

        /**
         * Eventos chegam fora de ordem. Aplicar o corpo de um evento
         * antigo por cima de um recente daria acesso a quem já cancelou,
         * ou o contrário; perguntar ao Stripe garante que se grava o que
         * vale agora.
         */
        it('lê o estado ao Stripe em vez de o deduzir do evento', async () => {
            await service.applyEvent(
                evento('customer.subscription.updated', {
                    id: 'sub_stripe_1',
                    status: 'active',
                    metadata: { ownerKind: 'user', ownerId: compra.ownerId },
                }),
            );

            expect(gateway.readSubscription).toHaveBeenCalledWith('sub_stripe_1');
        });

        /**
         * O Stripe reenvia eventos quando não recebe resposta a tempo.
         * Sem isto, um reenvio criava um segundo período: o cliente
         * pagava uma vez e ficava com dois meses.
         */
        it('não aplica duas vezes o mesmo evento', async () => {
            repository.claimEvent.mockResolvedValue(false);

            await expect(service.applyEvent(completado())).resolves.toBe(
                'duplicate',
            );

            expect(repository.upsertPeriod).not.toHaveBeenCalled();
        });

        it('regista o evento antes de o aplicar', async () => {
            await service.applyEvent(completado());

            const ordemClaim = repository.claimEvent.mock.invocationCallOrder[0] as number;
            const ordemUpsert = repository.upsertPeriod.mock
                .invocationCallOrder[0] as number;

            expect(ordemClaim).toBeLessThan(ordemUpsert);
        });

        /**
         * O Stripe envia dezenas de tipos de evento. Reagir a um que não
         * se entende é pior do que não reagir.
         */
        it('ignora um tipo de evento que não trata', async () => {
            await expect(
                service.applyEvent(evento('customer.created', { id: 'cus_1' })),
            ).resolves.toBe('ignored');

            expect(repository.claimEvent).not.toHaveBeenCalled();
        });

        it('ignora uma compra que não é de subscrição', async () => {
            await expect(
                service.applyEvent(
                    evento('checkout.session.completed', { subscription: null }),
                ),
            ).resolves.toBe('ignored');

            expect(repository.upsertPeriod).not.toHaveBeenCalled();
        });

        /**
         * As renovações chegam sem metadados: o titular foi decidido na
         * primeira compra e é lá que se vai buscá-lo.
         */
        it('encontra o titular de uma renovação pela subscrição já gravada', async () => {
            repository.findByProviderSubscriptionId.mockResolvedValue({
                userId: null,
                crewId: 'crew-1',
                serverId: null,
            });

            await expect(
                service.applyEvent(
                    evento('invoice.paid', { subscription: 'sub_stripe_1' }),
                ),
            ).resolves.toBe('applied');

            expect(repository.upsertPeriod).toHaveBeenCalledWith(
                expect.objectContaining({ owner: { crewId: 'crew-1' } }),
            );
        });

        it('ignora um evento cujo titular não se consegue determinar', async () => {
            await expect(
                service.applyEvent(
                    evento('invoice.paid', { subscription: 'sub_desconhecida' }),
                ),
            ).resolves.toBe('ignored');

            expect(repository.upsertPeriod).not.toHaveBeenCalled();
        });

        it('marca o evento como tratado', async () => {
            await service.applyEvent(completado());

            expect(repository.markEventProcessed).toHaveBeenCalledWith('evt_1');
        });
    });

    /**
     * O que acontece a quem deixa de pagar. É a metade da cobrança que
     * mais facilmente se parte, e a que decide se alguém tem premium de
     * graça para sempre.
     */
    describe('estados traduzidos', () => {
        const comEstado = async (status: string) => {
            gateway.readSubscription.mockResolvedValue(
                periodo({ status: status as StripePeriod['status'] }),
            );

            await service.applyEvent(
                evento(
                    'customer.subscription.updated',
                    {
                        id: 'sub_stripe_1',
                        metadata: { ownerKind: 'user', ownerId: compra.ownerId },
                    },
                    `evt_${status}`,
                ),
            );

            return repository.upsertPeriod.mock.calls[0]?.[0] as {
                status: string;
                endedAt: Date | null;
            };
        };

        it.each([
            ['active', 'active'],
            ['trialing', 'trialing'],
            /** Pagamento em falta corta o acesso já: past_due não dá direito. */
            ['past_due', 'past_due'],
            ['unpaid', 'past_due'],
            ['incomplete', 'past_due'],
            ['incomplete_expired', 'expired'],
            ['canceled', 'canceled'],
            ['paused', 'canceled'],
        ])('%s do Stripe fica %s', async (stripeStatus, esperado) => {
            const gravado = await comEstado(stripeStatus);

            expect(gravado.status).toBe(esperado);
        });

        it('uma subscrição terminada fica com a data em que acabou', async () => {
            const gravado = await comEstado('canceled');

            expect(gravado.endedAt).toBeInstanceOf(Date);
        });

        it('uma subscrição a decorrer não fica com data de fim', async () => {
            const gravado = await comEstado('active');

            expect(gravado.endedAt).toBeNull();
        });
    });
});
