import type Stripe from 'stripe';

import {
    PLANS,
    PLAN_KEYS,
    SubscriptionPlan,
    SubscriptionStatus,
    isPerpetualPlan,
    planDefinition,
} from '@vicehub/database';
import type { PlanKey } from '@vicehub/database';

import { AuthorizationError } from '../../authorization/errors/authorization.errors.js';
import type { AuthorizationService } from '../../authorization/services/authorization.service.js';
import { BillingError } from '../errors/billing.errors.js';
import type { BillingRepository } from '../repositories/billing.repository.js';
import type { StripeGateway, StripePeriod } from './stripe.gateway.js';
import type {
    SubscriptionOwner,
    SubscriptionOwnerKind,
} from '../../subscriptions/types/subscription.types.js';

interface StartCheckoutInput {
    ownerKind: SubscriptionOwnerKind;
    ownerId: string;
    buyerId: string;
    /** Qual dos escalões. Antes não existia, e vendia-se sempre o mesmo. */
    plan: string;
}

/**
 * Um plano tal como aparece a quem ainda não o tem.
 */
export interface PurchasablePlan {
    key: string;
    name: string;
    description: string;
    priceCents: number;
    currency: string;
    intervalMonths: number;
    /**
     * Quem compra este plano: uma crew ou um servidor.
     *
     * Vai para o ecrã para que ele mostre os escalões de servidor a
     * quem veio de um servidor, e o da crew a quem veio de uma crew,
     * sem ter aqui a lista escrita uma segunda vez.
     */
    ownerKind: 'crew' | 'server';
    /**
     * Quantas crews este escalão deixa jogar no servidor, quando o
     * plano é de servidor. `null` é sem limite.
     *
     * É a única coisa que distingue os três escalões uns dos outros, e
     * sem ela a lista de preços mostrava três linhas cujo preço sobe
     * sem dizer porquê.
     */
    maxCrews?: number | null;
}

/**
 * O que se pode comprar, e se a compra está sequer aberta.
 */
export interface PlanCatalogue {
    available: boolean;
    plans: PurchasablePlan[];
}

/**
 * Estados do Stripe traduzidos para os nossos.
 *
 * Declarado como mapa, e não como cadeia de ifs, para que um estado novo
 * do Stripe seja um erro de compilação em vez de cair silenciosamente
 * num valor por omissão que talvez desse acesso.
 */
const STATUS_BY_STRIPE_STATUS: Record<
    Stripe.Subscription.Status,
    SubscriptionStatus
> = {
    active: SubscriptionStatus.active,
    trialing: SubscriptionStatus.trialing,
    /**
     * Um pagamento em falta corta o acesso já. O Stripe continua a
     * tentar cobrar durante uns dias e, se conseguir, manda outro evento
     * e o acesso volta sozinho.
     */
    past_due: SubscriptionStatus.past_due,
    unpaid: SubscriptionStatus.past_due,
    incomplete: SubscriptionStatus.past_due,
    incomplete_expired: SubscriptionStatus.expired,
    canceled: SubscriptionStatus.canceled,
    paused: SubscriptionStatus.canceled,
};

/**
 * Eventos que dizem alguma coisa sobre o estado de uma subscrição.
 *
 * Tudo o resto é ignorado de propósito: o Stripe envia dezenas de tipos,
 * e reagir a um que não se entende é pior do que não reagir.
 */
const HANDLED_EVENTS = new Set([
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_failed',
    'invoice.paid',
]);

/**
 * Serviço da cobrança pelo Stripe.
 *
 * A regra que organiza tudo isto: **quem cobra é que sabe**. Enquanto o
 * plano é concedido à mão, os períodos são calculados aqui; a partir do
 * momento em que o Stripe cobra, as datas, o preço e o estado vêm dele.
 * Uma segunda contagem nossa acabaria por discordar da fatura, sempre
 * num dia em que alguém está a olhar.
 */
export class BillingService {
    constructor(
        private readonly billingRepository: BillingRepository,
        private readonly stripe: StripeGateway | null,
        private readonly authorizationService: AuthorizationService,
        /**
         * O preço do Stripe de cada plano que esta instalação vende.
         *
         * Entra por aqui e não é lido do ambiente, como a gateway: o que
         * está à venda é uma propriedade da instalação, e um serviço que
         * a fosse buscar sozinho não podia ser posto a vender outra
         * coisa num teste sem lhe mexer no ambiente inteiro.
         *
         * Um plano sem entrada aqui não se vende: não aparece na lista
         * de preços e o checkout recusa-o.
         */
        private readonly priceIds: Readonly<Record<string, string>> = {},
    ) { }

    /**
     * O catálogo do que se compra, com o preço em vigor.
     *
     * O `available` diz se a cobrança está configurada nesta instalação.
     * Sai daqui, e não do clique, para que o ecrã possa dizer "ainda não
     * abriu" em vez de oferecer um botão que responde 503 — um 503 depois
     * de alguém decidir pagar lê-se como avaria, e é a pior altura para
     * parecer avariado.
     *
     * Os planos perpétuos ficam de fora: o vitalício é concedido à mão, e
     * anunciá-lo a zero numa lista de preços seria prometer de graça o
     * que é um gesto.
     */
    listPurchasablePlans(): PlanCatalogue {
        return {
            available: this.stripe !== null,
            plans: PLAN_KEYS.flatMap((key) => {
                const plano = planDefinition(key);

                /**
                 * Sem período não há o que cobrar todos os meses. As duas
                 * condições dizem a mesma coisa por caminhos diferentes, e
                 * ambas ficam: a segunda é o que dá o tipo sem período
                 * nulo, sem ter de o inventar mais abaixo.
                 */
                if (isPerpetualPlan(plano.plan) || plano.intervalMonths === null) {
                    return [];
                }

                /**
                 * E os que **esta instalação** não sabe cobrar.
                 *
                 * Um plano vende-se aqui se, e só se, tiver um preço do
                 * Stripe configurado. Anunciar um escalão sem preço era
                 * prometer uma coisa e cobrar outra — o pior erro que
                 * uma lista de preços pode ter —, e é por isso que a
                 * condição é a existência do preço e não uma marca no
                 * catálogo: o catálogo não sabe o que está configurado.
                 *
                 * Também deixa de fora os que não se compram de todo,
                 * porque esses nunca têm preço.
                 */
                if (
                    plano.ownerKind === undefined ||
                    this.priceIds[key] === undefined
                ) {
                    return [];
                }

                return [
                    {
                        key,
                        name: plano.name,
                        description: plano.description,
                        priceCents: plano.priceCents,
                        currency: plano.currency,
                        intervalMonths: plano.intervalMonths,
                        ownerKind: plano.ownerKind,
                        ...(plano.maxCrews === undefined
                            ? {}
                            : { maxCrews: plano.maxCrews }),
                    },
                ];
            }),
        };
    }

    /**
     * Começa uma compra e devolve para onde encaminhar quem a fez.
     */
    async startCheckout(input: StartCheckoutInput): Promise<{ url: string }> {
        /**
         * Antes de olhar para a configuração: "não podes" é uma
         * propriedade do pedido e não da instalação. Pela ordem
         * contrária, um sítio sem chaves respondia 503 a toda a gente e
         * a recusa por falta de autorização deixava de ser observável —
         * incluindo para quem a quisesse testar.
         */
        await this.assertMayCommit(input);

        /**
         * Que plano é este, e se é sequer para este titular.
         *
         * Vem antes da configuração pela mesma razão que a autorização:
         * pedir o escalão errado é uma propriedade do **pedido**, e não
         * da instalação. Pela ordem contrária, um sítio sem chaves
         * respondia 503 a quem pedisse um plano que nem existe.
         */
        this.assertPlanFits(input.plan, input.ownerKind);

        const stripe = this.requireStripe();

        /**
         * E só agora o preço, que é uma propriedade da **instalação**:
         * o escalão existe e serve, o que falta é esta instalação
         * tê-lo aberto. Um 503 antes disto escondia a diferença entre
         * "a cobrança não está ligada" e "esse escalão ainda não abriu".
         */
        const priceId = this.requirePriceId(input.plan);

        const owner = this.buildOwner(input.ownerKind, input.ownerId);

        const existe = await this.billingRepository.ownerExists(
            input.ownerKind,
            input.ownerId,
        );

        if (!existe) {
            throw new BillingError(
                'BILLING_OWNER_NOT_FOUND',
                'Não existe utilizador, crew ou servidor com este identificador.',
            );
        }

        /**
         * Receber dinheiro por uma coisa que já foi oferecida é a
         * espécie de erro que ninguém repara e toda a gente acha mal.
         */
        if (await this.billingRepository.hasPerpetualAccess(owner)) {
            throw new BillingError(
                'ALREADY_LIFETIME',
                'Este titular já tem acesso vitalício e não precisa de pagar.',
            );
        }

        const comprador = await this.billingRepository.findUserEmail(input.buyerId);

        if (!comprador) {
            throw new BillingError(
                'BILLING_OWNER_NOT_FOUND',
                'A conta que está a comprar não foi encontrada.',
            );
        }

        const customerId = await this.billingRepository.findCustomerId(owner);

        return stripe.createCheckoutSession({
            ownerKind: input.ownerKind,
            ownerId: input.ownerId,
            buyerId: input.buyerId,
            buyerEmail: comprador.email,
            priceId,
            ...(customerId === null ? {} : { customerId }),
        });
    }

    /**
     * Se este plano existe e se vende a esta espécie de titular.
     *
     * É a metade da pergunta que depende só do pedido, e por isso é
     * feita antes de se olhar para a configuração.
     */
    private assertPlanFits(
        plan: string,
        ownerKind: SubscriptionOwnerKind,
    ): void {
        const definicao = (PLAN_KEYS as readonly string[]).includes(plan)
            ? planDefinition(plan as PlanKey)
            : undefined;

        if (definicao === undefined || definicao.ownerKind === undefined) {
            throw new BillingError(
                'PLAN_NOT_PURCHASABLE',
                'Esse plano não existe ou não está à venda.',
            );
        }

        /**
         * O que um escalão de servidor vende são lugares para crews, e
         * uma crew não tem onde os pôr; o da crew abre a tesouraria de
         * uma crew, e um servidor não é uma. Nenhuma das duas compras
         * dava nada a quem a fizesse, e ambas eram cobradas.
         */
        if (definicao.ownerKind !== ownerKind) {
            throw new BillingError(
                'PLAN_WRONG_OWNER',
                definicao.ownerKind === 'server'
                    ? 'Esse plano é de um servidor, e este titular não é um.'
                    : 'Esse plano é de uma crew, e este titular não é uma.',
            );
        }
    }

    /**
     * O preço do Stripe para este plano nesta instalação.
     *
     * A metade que depende da configuração. O escalão já se sabe que
     * existe e que serve: o que falta é esta instalação tê-lo aberto,
     * que é uma coisa de quem a opera e não de quem clica.
     */
    private requirePriceId(plan: string): string {
        const priceId = this.priceIds[plan];

        if (priceId === undefined) {
            throw new BillingError(
                'PLAN_NOT_PURCHASABLE',
                'Esse plano ainda não está à venda nesta instalação.',
            );
        }

        return priceId;
    }

    /**
     * Que plano é o que o Stripe está a cobrar nesta subscrição.
     *
     * Lê-se do preço e não dos metadados que lhe pendurámos na compra:
     * os metadados são o que dissemos na altura, o preço é o que está a
     * ser cobrado agora. Uma mudança de escalão feita no painel do
     * Stripe muda o preço e não os metadados, e nesse caso o que vale é
     * a fatura.
     *
     * Um preço que não conhecemos — um criado à mão no painel, ou o de
     * uma instalação anterior — fica com o plano de crew, que é o mais
     * pequeno: na dúvida dá-se o menos, porque o contrário é oferecer
     * lugares que ninguém pagou.
     */
    private planForPrice(priceId: string): SubscriptionPlan {
        const chave = Object.keys(this.priceIds).find(
            (plano) => this.priceIds[plano] === priceId,
        );

        return chave === undefined
            ? SubscriptionPlan.premium
            : planDefinition(chave as PlanKey).plan;
    }

    /**
     * Verifica a assinatura de um evento e devolve-o.
     *
     * É esta verificação que separa um evento do Stripe de um pedido que
     * alguém inventou para se dar premium: sem ela, a rota de webhook
     * seria uma forma pública de conceder planos.
     */
    verifyEvent(rawBody: Buffer, signature: string): Stripe.Event {
        return this.requireStripe().constructEvent(rawBody, signature);
    }

    /**
     * Aplica um evento já verificado.
     *
     * Devolve o que aconteceu, para que a rota possa responder ao Stripe
     * com verdade sem lhe dar detalhes.
     */
    async applyEvent(
        event: Stripe.Event,
    ): Promise<'applied' | 'duplicate' | 'ignored'> {
        if (!HANDLED_EVENTS.has(event.type)) {
            return 'ignored';
        }

        /**
         * O registo do evento vem antes de o aplicar: se duas entregas
         * do mesmo evento chegarem ao mesmo tempo, só uma passa daqui.
         */
        const primeiro = await this.billingRepository.claimEvent({
            id: event.id,
            type: event.type,
            payload: event.data.object,
        });

        if (!primeiro) {
            return 'duplicate';
        }

        const subscriptionId = this.readSubscriptionId(event);

        if (subscriptionId === null) {
            await this.billingRepository.markEventProcessed(event.id);

            return 'ignored';
        }

        /**
         * O estado é lido do Stripe em vez de deduzido do corpo do
         * evento. Eventos chegam fora de ordem, e aplicar um antigo por
         * cima de um recente daria acesso a quem já cancelou — ou o
         * contrário. Perguntar garante que se grava o que vale agora.
         */
        const periodo = await this.requireStripe().readSubscription(subscriptionId);

        const owner = await this.readOwner(event, periodo);

        if (owner === null) {
            await this.billingRepository.markEventProcessed(event.id);

            return 'ignored';
        }

        await this.applyPeriod(owner, periodo);

        await this.billingRepository.markEventProcessed(event.id);

        return 'applied';
    }

    /**
     * Grava um período tal como o Stripe o descreve.
     */
    private async applyPeriod(
        owner: SubscriptionOwner,
        periodo: StripePeriod,
    ): Promise<void> {
        const status = STATUS_BY_STRIPE_STATUS[periodo.status];

        await this.billingRepository.upsertPeriod({
            owner,
            providerSubscriptionId: periodo.subscriptionId,
            providerCustomerId: periodo.customerId,
            plan: this.planForPrice(periodo.priceId),
            status,
            priceCents: periodo.priceCents,
            currency: periodo.currency,
            periodStart: periodo.currentPeriodStart,
            periodEnd: periodo.currentPeriodEnd,
            cancelAtPeriodEnd: periodo.cancelAtPeriodEnd,
            /**
             * Uma subscrição terminada fica com a data em que acabou. O
             * registo não é apagado: o histórico continua a dizer que
             * existiu e até quando.
             */
            endedAt:
                status === SubscriptionStatus.canceled ||
                    status === SubscriptionStatus.expired
                    ? new Date()
                    : null,
        });
    }

    /**
     * Manda o Stripe parar de renovar.
     *
     * O período em curso mantém-se: quem pagou o mês fica com o mês.
     */
    async cancelAtPeriodEnd(providerSubscriptionId: string): Promise<void> {
        await this.requireStripe().cancelAtPeriodEnd(providerSubscriptionId);
    }

    /**
     * O identificador da subscrição, seja qual for o evento.
     *
     * Os vários tipos guardam-no em sítios diferentes, e é isso que esta
     * função esconde do resto do serviço.
     */
    private readSubscriptionId(event: Stripe.Event): string | null {
        const objeto = event.data.object as unknown as Record<string, unknown>;

        if (event.type.startsWith('customer.subscription.')) {
            return typeof objeto['id'] === 'string' ? objeto['id'] : null;
        }

        const subscription = objeto['subscription'];

        if (typeof subscription === 'string') {
            return subscription;
        }

        if (
            subscription !== null &&
            typeof subscription === 'object' &&
            typeof (subscription as { id?: unknown }).id === 'string'
        ) {
            return (subscription as { id: string }).id;
        }

        /**
         * Uma sessão de checkout que não seja de subscrição — um
         * pagamento único, um dia — não tem aqui nada a fazer.
         */
        return null;
    }

    /**
     * O titular do plano, lido dos metadados que viajaram com a compra.
     *
     * O webhook não traz mais nada que ligue o pagamento a uma crew: sem
     * estes metadados, saber-se-ia que alguém pagou e não a quem dar o
     * plano.
     */
    private async readOwner(
        event: Stripe.Event,
        periodo: StripePeriod,
    ): Promise<SubscriptionOwner | null> {
        const objeto = event.data.object as unknown as {
            metadata?: Record<string, string> | null;
        };

        const metadata = objeto.metadata ?? null;

        const kind = metadata?.['ownerKind'];
        const id = metadata?.['ownerId'];

        if (this.isOwnerKind(kind) && typeof id === 'string' && id.length > 0) {
            return this.buildOwner(kind, id);
        }

        /**
         * Sem metadados no evento, procura-se pela subscrição já
         * gravada: as renovações chegam sem eles, e o titular foi
         * decidido na primeira vez.
         */
        return this.ownerOfKnownSubscription(periodo.subscriptionId);
    }

    private async ownerOfKnownSubscription(
        providerSubscriptionId: string,
    ): Promise<SubscriptionOwner | null> {
        const existente = await this.billingRepository.findByProviderSubscriptionId(
            providerSubscriptionId,
        );

        if (!existente) {
            return null;
        }

        return {
            ...(existente.userId ? { userId: existente.userId } : {}),
            ...(existente.crewId ? { crewId: existente.crewId } : {}),
            ...(existente.serverId ? { serverId: existente.serverId } : {}),
        };
    }

    private isOwnerKind(value: unknown): value is SubscriptionOwnerKind {
        return value === 'user' || value === 'crew' || value === 'server';
    }

    private buildOwner(
        kind: SubscriptionOwnerKind,
        id: string,
    ): SubscriptionOwner {
        if (kind === 'user') {
            return { userId: id };
        }

        return kind === 'crew' ? { crewId: id } : { serverId: id };
    }

    /**
     * Recusa a operação quando a cobrança não está configurada.
     *
     * Sem chaves, a plataforma funciona toda menos a compra pelo próprio.
     * Dizer isso claramente é melhor do que um 500 de uma biblioteca sem
     * configuração.
     */
    /**
     * Quem pode comprometer este titular a uma cobrança recorrente.
     *
     * A rota exige conta e mais nada porque a resposta depende do titular
     * pedido no corpo, que o guard de autorização não sabe ler: para si
     * próprio basta ser-se o próprio, para uma crew ou um servidor é
     * preciso mandar lá dentro.
     *
     * Sem esta verificação, qualquer conta punha o seu cartão a pagar a
     * crew de outra pessoa. Não é roubo — é pior de desfazer: fica uma
     * cobrança recorrente presa a uma comunidade que quem paga não
     * controla, e quem lá manda não a consegue cancelar, porque o cliente
     * no Stripe não é dele. Bastava também um cartão contestado para
     * arrastar uma crew alheia para uma disputa de pagamento que ela
     * nunca fez.
     *
     * Os três casos recusam com o mesmo erro de propósito: um código
     * diferente conforme a verificação que falhou diria a quem tenta às
     * cegas qual delas passou.
     */
    private async assertMayCommit(input: StartCheckoutInput): Promise<void> {
        /**
         * Não há plano nenhum para uma pessoa comprar para si.
         *
         * Durante um tempo houve: dava para personalizar o perfil. A
         * personalização passou a ser de graça para toda a gente, e o
         * que ficou do lado pago é gestão de uma comunidade — a
         * tesouraria de uma crew, os lugares de um servidor. Nada disso
         * é de uma pessoa.
         *
         * Deixar comprar na mesma seria cobrar por coisa nenhuma. Não é
         * 403: quem pede tem toda a autorização para comprar para si; o
         * que não existe é o que estaria a comprar.
         */
        if (input.ownerKind === 'user') {
            throw new BillingError(
                'PLAN_IS_FOR_COMMUNITIES',
                'O plano é de uma crew ou de um servidor. Para uma conta não há nada a comprar.',
            );
        }

        const necessaria =
            input.ownerKind === 'crew' ? 'crew:manage' : 'server:manage';

        const efetivas = await this.authorizationService.getEffectivePermissions(
            input.buyerId,
            input.ownerKind === 'crew'
                ? { crewId: input.ownerId }
                : { serverId: input.ownerId },
        );

        if (!this.authorizationService.hasPermissions(efetivas, [necessaria])) {
            throw new AuthorizationError(
                'INSUFFICIENT_PERMISSIONS',
                'Não tens autorização para comprar um plano para este titular.',
                [necessaria],
            );
        }
    }

    private requireStripe(): StripeGateway {
        if (!this.stripe) {
            throw new BillingError(
                'BILLING_NOT_CONFIGURED',
                'A cobrança não está configurada nesta instalação.',
            );
        }

        return this.stripe;
    }
}
