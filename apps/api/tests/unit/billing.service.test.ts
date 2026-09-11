import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';

import { AuthorizationError } from '../../src/modules/authorization/errors/authorization.errors.js';
import { BillingError } from '../../src/modules/billing/errors/billing.errors.js';
import { BillingService } from '../../src/modules/billing/services/billing.service.js';
import type { AuthorizationService } from '../../src/modules/authorization/services/authorization.service.js';
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
    priceId: 'price_crew',
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

/**
 * Os preços desta instalação de teste, um por plano.
 *
 * Os três escalões de servidor estão cá para que os testes possam
 * provar que cada um vende o **seu** preço — que é precisamente o que
 * não acontecia quando havia um preço só.
 */
const PRECOS = {
    premium: 'price_crew',
    server_base: 'price_server_base',
    server_plus: 'price_server_plus',
    server_unlimited: 'price_server_unlimited',
};

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

/**
 * Por omissão deixa passar, para que os testes que não são sobre
 * autorização continuem a medir o que mediam. Os que são sobre ela
 * mandam-no recusar.
 */
const createAuthorizationMock = () => ({
    getEffectivePermissions: vi
        .fn()
        .mockResolvedValue({ userId: 'x', scope: {}, permissions: new Set() }),
    hasPermissions: vi.fn().mockReturnValue(true),
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
    let autorizacao: ReturnType<typeof createAuthorizationMock>;
    let service: BillingService;

    /**
     * Comprar para si próprio, que é o caso legítimo mais simples. O
     * titular e o comprador são a mesma pessoa de propósito: eram
     * diferentes, e isso passou a ser recusado — comprar para a conta de
     * outra pessoa prende a cobrança recorrente de quem paga a uma conta
     * que não é sua.
     */
    const EU = '22222222-2222-4222-8222-222222222222';
    const OUTRA_PESSOA = '33333333-3333-4333-8333-333333333333';
    const UMA_CREW = '11111111-1111-4111-8111-111111111111';

    /**
     * A compra normal é **de uma crew**, e não de uma pessoa. O plano é
     * de uma comunidade: a tesouraria que ele abre é de uma crew, os
     * lugares que dá são de um servidor. Uma pessoa que comprasse para
     * si não comprava nada, e a API recusa-o.
     */
    const compra = {
        ownerKind: 'crew' as const,
        ownerId: UMA_CREW,
        buyerId: EU,
        plan: 'premium',
    };

    beforeEach(() => {
        repository = createRepositoryMock();
        gateway = createGatewayMock();
        autorizacao = createAuthorizationMock();

        service = new BillingService(
            repository as unknown as BillingRepository,
            gateway as unknown as StripeGateway,
            autorizacao as unknown as AuthorizationService,
            PRECOS,
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
                createAuthorizationMock() as unknown as AuthorizationService,
                PRECOS,
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
                createAuthorizationMock() as unknown as AuthorizationService,
                PRECOS,
            );

            expect(() =>
                semStripe.verifyEvent(Buffer.from('{}'), 'assinatura'),
            ).toThrow(BillingError);
        });

        /**
         * O catálogo continua a responder, e diz que a compra não está
         * aberta. É o que deixa o ecrã avisar antes do clique: um 503
         * depois de alguém decidir pagar lê-se como avaria, e é a pior
         * altura para parecer avariado.
         */
        it('diz o preço na mesma, e que ainda não se compra', () => {
            const semStripe = new BillingService(
                repository as unknown as BillingRepository,
                null,
                createAuthorizationMock() as unknown as AuthorizationService,
                PRECOS,
            );

            const catalogo = semStripe.listPurchasablePlans();

            expect(catalogo.available).toBe(false);
            expect(catalogo.plans.length).toBeGreaterThan(0);
        });
    });

    describe('o catálogo do que se compra', () => {
        it('diz que a compra está aberta quando há Stripe', () => {
            expect(service.listPurchasablePlans().available).toBe(true);
        });

        it('traz o premium com o preço em vigor', () => {
            const premium = service
                .listPurchasablePlans()
                .plans.find((plano) => plano.key === 'premium');

            expect(premium).toMatchObject({
                priceCents: 499,
                currency: 'EUR',
                intervalMonths: 1,
            });
        });

        /**
         * O vitalício é concedido à mão, um a um. Anunciá-lo a zero numa
         * lista de preços seria prometer de graça o que é um gesto — e
         * quem clicasse não teria nada para pagar.
         */
        it('não anuncia o vitalício', () => {
            const chaves = service
                .listPurchasablePlans()
                .plans.map((plano) => plano.key);

            expect(chaves).not.toContain('lifetime');
        });

        /**
         * O que sai daqui é o que o ecrã mostra. Um plano sem período não
         * pode ser cobrado todos os meses, e mostrá-lo como se pudesse
         * seria prometer uma cobrança que não existe.
         */
        it('nunca traz um plano sem período', () => {
            for (const plano of service.listPurchasablePlans().plans) {
                expect(plano.intervalMonths).toBeGreaterThan(0);
            }
        });

        it.each([
            ['server_base', 1_499, 10],
            ['server_plus', 1_999, 50],
            ['server_unlimited', 9_999, null],
        ])('traz %s com o seu preço e os seus lugares', (chave, cents, crews) => {
            const escalao = service
                .listPurchasablePlans()
                .plans.find((plano) => plano.key === chave);

            expect(escalao).toMatchObject({
                priceCents: cents,
                currency: 'EUR',
                ownerKind: 'server',
                maxCrews: crews,
            });
        });

        /**
         * Cada plano diz de quem é, e o ecrã escolhe por aí.
         *
         * Sem isto, o ecrã de um servidor teria a lista dos escalões
         * escrita uma segunda vez — e a segunda cópia envelhecia no dia
         * em que aparecesse um escalão novo.
         */
        it('diz que o plano da crew é de uma crew', () => {
            const premium = service
                .listPurchasablePlans()
                .plans.find((plano) => plano.key === 'premium');

            expect(premium?.ownerKind).toBe('crew');
        });

        /**
         * **Um plano vende-se se, e só se, esta instalação tiver preço
         * para ele.**
         *
         * É o que impede uma lista de preços de anunciar um escalão que
         * a cobrança não sabe cobrar — prometer um preço e cobrar outro
         * é o pior erro que uma lista de preços pode ter. Era assim que
         * os três escalões de servidor estiveram anunciados sem que
         * houvesse forma de os pagar.
         */
        it('não anuncia um escalão sem preço configurado', () => {
            const sóCrew = new BillingService(
                repository as unknown as BillingRepository,
                gateway as unknown as StripeGateway,
                autorizacao as unknown as AuthorizationService,
                { premium: 'price_crew' },
            );

            expect(
                sóCrew.listPurchasablePlans().plans.map((plano) => plano.key),
            ).toEqual(['premium']);
        });

        /**
         * Chaves sem preço nenhum são recusadas ao arrancar, por isso
         * este caso não chega a acontecer em produção. Continua a ser
         * a resposta certa: uma lista vazia, e não um escalão a mais.
         */
        it('não anuncia nada quando não há preço nenhum', () => {
            const semPrecos = new BillingService(
                repository as unknown as BillingRepository,
                gateway as unknown as StripeGateway,
                autorizacao as unknown as AuthorizationService,
                {},
            );

            expect(semPrecos.listPurchasablePlans().plans).toEqual([]);
        });
    });

    /**
     * **O que separa um escalão do outro é o preço que se cobra.**
     *
     * Antes havia um preço configurado só, e o checkout vendia esse
     * fosse qual fosse o plano pedido: um servidor que comprasse o
     * escalão sem limite pagava 4,99 € e ficava com o plano de uma
     * crew, que lhe dava três lugares. Estes testes são o que impede
     * isso de voltar.
     */
    describe('que escalão se está a comprar', () => {
        it.each([
            ['server_base', 'price_server_base'],
            ['server_plus', 'price_server_plus'],
            ['server_unlimited', 'price_server_unlimited'],
        ])('%s vai ao Stripe com o seu próprio preço', async (plan, priceId) => {
            await service.startCheckout({
                ownerKind: 'server',
                ownerId: UMA_CREW,
                buyerId: EU,
                plan,
            });

            expect(gateway.createCheckoutSession).toHaveBeenCalledWith(
                expect.objectContaining({ priceId }),
            );
        });

        it('o plano da crew vai com o preço da crew', async () => {
            await service.startCheckout(compra);

            expect(gateway.createCheckoutSession).toHaveBeenCalledWith(
                expect.objectContaining({ priceId: 'price_crew' }),
            );
        });

        /**
         * Um escalão de servidor vende lugares para crews, e uma crew
         * não tem onde os pôr; o da crew abre a tesouraria de uma crew,
         * e um servidor não é uma. Nenhuma das duas compras dava nada a
         * quem a fizesse, e ambas eram cobradas.
         */
        it('recusa vender um escalão de servidor a uma crew', async () => {
            await expectBillingError(
                service.startCheckout({ ...compra, plan: 'server_plus' }),
                'PLAN_WRONG_OWNER',
            );

            expect(gateway.createCheckoutSession).not.toHaveBeenCalled();
        });

        it('recusa vender o plano de uma crew a um servidor', async () => {
            await expectBillingError(
                service.startCheckout({
                    ownerKind: 'server',
                    ownerId: UMA_CREW,
                    buyerId: EU,
                    plan: 'premium',
                }),
                'PLAN_WRONG_OWNER',
            );

            expect(gateway.createCheckoutSession).not.toHaveBeenCalled();
        });

        it('recusa um plano que não existe', async () => {
            await expectBillingError(
                service.startCheckout({ ...compra, plan: 'server_gigante' }),
                'PLAN_NOT_PURCHASABLE',
            );
        });

        /**
         * O vitalício é um gesto, e concede-se à mão. Vendê-lo era
         * cobrar por uma coisa que é para ser oferecida.
         */
        it('recusa vender o vitalício', async () => {
            await expectBillingError(
                service.startCheckout({ ...compra, plan: 'lifetime' }),
                'PLAN_NOT_PURCHASABLE',
            );
        });

        /**
         * O escalão existe no catálogo e esta instalação ainda não o
         * abriu. Para quem clica é a mesma coisa que não existir — e
         * separar os dois casos diria a quem tenta às cegas que
         * escalões estão escritos no código sem estarem à venda.
         */
        it('recusa um escalão que esta instalação ainda não vende', async () => {
            const sóCrew = new BillingService(
                repository as unknown as BillingRepository,
                gateway as unknown as StripeGateway,
                autorizacao as unknown as AuthorizationService,
                { premium: 'price_crew' },
            );

            await expectBillingError(
                sóCrew.startCheckout({
                    ownerKind: 'server',
                    ownerId: UMA_CREW,
                    buyerId: EU,
                    plan: 'server_base',
                }),
                'PLAN_NOT_PURCHASABLE',
            );

            expect(gateway.createCheckoutSession).not.toHaveBeenCalled();
        });
    });

    /**
     * O que fica gravado é o plano que o Stripe está mesmo a cobrar.
     *
     * Lê-se do preço da subscrição e não dos metadados que lhe
     * pendurámos na compra: uma mudança de escalão feita no painel do
     * Stripe muda o preço e não os metadados, e nesse caso o que vale é
     * a fatura. Gravar sempre `premium`, como se fazia, dava três
     * lugares a quem pagou sem limite.
     */
    describe('que plano fica gravado', () => {
        const aplicar = async (priceId: string) => {
            gateway.readSubscription.mockResolvedValue(periodo({ priceId }));

            await service.applyEvent(
                evento('customer.subscription.updated', {
                    id: 'sub_stripe_1',
                    metadata: {
                        ownerKind: 'server',
                        ownerId: UMA_CREW,
                    },
                }),
            );

            return repository.upsertPeriod.mock.calls[0]?.[0] as {
                plan: string;
            };
        };

        it.each([
            ['price_server_base', 'server_base'],
            ['price_server_plus', 'server_plus'],
            ['price_server_unlimited', 'server_unlimited'],
            ['price_crew', 'premium'],
        ])('%s fica gravado como %s', async (priceId, plan) => {
            expect((await aplicar(priceId)).plan).toBe(plan);
        });

        /**
         * Um preço que não conhecemos — criado à mão no painel — fica
         * com o plano mais pequeno. Na dúvida dá-se o menos: o
         * contrário é oferecer lugares que ninguém pagou.
         */
        it('um preço desconhecido fica com o plano mais pequeno', async () => {
            expect((await aplicar('price_inventado')).plan).toBe('premium');
        });
    });

    /**
     * A rota exige conta e mais nada, porque o titular vem no corpo e o
     * guard de autorização lê o âmbito dos parâmetros. Se não for aqui,
     * não é em lado nenhum — e qualquer conta punha o seu cartão a pagar
     * a crew de outra pessoa.
     */
    describe('quem pode comprometer o titular', () => {
        const esperarRecusa = async (promise: Promise<unknown>) => {
            const erro = await promise.catch((apanhado: unknown) => apanhado);

            expect(erro).toBeInstanceOf(AuthorizationError);
        };

        it('deixa comprar para uma crew que se gere', async () => {
            await expect(
                service.startCheckout(compra),
            ).resolves.toBeDefined();
        });

        /**
         * Não há plano nenhum para uma pessoa comprar para si.
         *
         * Durante um tempo houve — dava para personalizar o perfil —,
         * mas a personalização passou a ser de graça para toda a gente.
         * O que ficou do lado pago é gestão de uma comunidade, e isso
         * não é de ninguém em particular. Deixar comprar seria cobrar
         * por coisa nenhuma.
         */
        it('recusa comprar um plano para a própria conta', async () => {
            await expect(
                service.startCheckout({
                    ownerKind: 'user',
                    ownerId: EU,
                    buyerId: EU,
                    plan: 'premium',
                }),
            ).rejects.toMatchObject({ code: 'PLAN_IS_FOR_COMMUNITIES' });
        });

        it('recusa comprar para a conta de outra pessoa', async () => {
            await expect(
                service.startCheckout({
                    ownerKind: 'user',
                    ownerId: OUTRA_PESSOA,
                    buyerId: EU,
                    plan: 'premium',
                }),
            ).rejects.toMatchObject({ code: 'PLAN_IS_FOR_COMMUNITIES' });
        });

        /**
         * A recusa vem **antes** de se olhar para a configuração: uma
         * instalação sem Stripe respondia 503 a toda a gente, e a razão
         * verdadeira — não há nada para comprar — ficava escondida.
         */
        it('recusa a compra pessoal mesmo sem cobrança configurada', async () => {
            const semStripe = new BillingService(
                repository as unknown as BillingRepository,
                null,
                createAuthorizationMock() as unknown as AuthorizationService,
                PRECOS,
            );

            await expect(
                semStripe.startCheckout({
                    ownerKind: 'user',
                    ownerId: EU,
                    buyerId: EU,
                    plan: 'premium',
                }),
            ).rejects.toMatchObject({ code: 'PLAN_IS_FOR_COMMUNITIES' });
        });

        it('exige crew:manage para comprar para uma crew', async () => {
            autorizacao.hasPermissions.mockReturnValue(false);

            await esperarRecusa(
                service.startCheckout({
                    ownerKind: 'crew',
                    ownerId: UMA_CREW,
                    buyerId: EU,
                    plan: 'premium',
                }),
            );

            expect(autorizacao.getEffectivePermissions).toHaveBeenCalledWith(EU, {
                crewId: UMA_CREW,
            });
            expect(autorizacao.hasPermissions).toHaveBeenCalledWith(
                expect.anything(),
                ['crew:manage'],
            );
        });

        it('exige server:manage para comprar para um servidor', async () => {
            autorizacao.hasPermissions.mockReturnValue(false);

            await esperarRecusa(
                service.startCheckout({
                    ownerKind: 'server',
                    ownerId: UMA_CREW,
                    buyerId: EU,
                    plan: 'server_base',
                }),
            );

            expect(autorizacao.getEffectivePermissions).toHaveBeenCalledWith(EU, {
                serverId: UMA_CREW,
            });
        });

        it('deixa passar quem manda na crew', async () => {
            await expect(
                service.startCheckout({
                    ownerKind: 'crew',
                    ownerId: UMA_CREW,
                    buyerId: EU,
                    plan: 'premium',
                }),
            ).resolves.toBeDefined();
        });

        /**
         * A recusa vem antes de o Stripe ser sequer contactado: uma
         * sessão de pagamento criada e depois recusada deixava lixo na
         * conta do Stripe por cada tentativa.
         */
        it('recusa antes de falar com o Stripe', async () => {
            autorizacao.hasPermissions.mockReturnValue(false);

            await esperarRecusa(
                service.startCheckout({
                    ownerKind: 'crew',
                    ownerId: UMA_CREW,
                    buyerId: EU,
                    plan: 'premium',
                }),
            );

            expect(gateway.createCheckoutSession).not.toHaveBeenCalled();
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
