import Stripe from 'stripe';

import { stripeConfig } from '../../../config/env.js';
import { BillingError } from '../errors/billing.errors.js';

export interface CheckoutRequest {
    /** Identifica o titular do plano para o webhook que há de chegar. */
    ownerKind: 'user' | 'crew' | 'server';
    ownerId: string;
    /** Quem clicou. Serve de cliente no Stripe e para o recibo. */
    buyerId: string;
    buyerEmail: string;
    /** Cliente já existente no Stripe, quando este titular já comprou. */
    customerId?: string | undefined;
}

/**
 * Um período de plano tal como o Stripe o descreve.
 *
 * As datas vêm do Stripe e não são calculadas por nós. Quando é ele que
 * cobra, é ele que sabe quando começa e acaba cada período — e uma
 * segunda contagem nossa acabaria por discordar da fatura, sempre num
 * dia em que alguém está a olhar.
 */
export interface StripePeriod {
    subscriptionId: string;
    customerId: string;
    status: Stripe.Subscription.Status;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    priceCents: number;
    currency: string;
}

/**
 * O que a plataforma precisa do Stripe, e mais nada.
 *
 * Existe para que o resto do módulo não conheça a biblioteca: os
 * serviços falam desta interface, e os testes trocam-na por um duplo sem
 * ter de imitar o SDK inteiro nem fazer pedidos à rede.
 */
export interface StripeGateway {
    createCheckoutSession(request: CheckoutRequest): Promise<{ url: string }>;
    /**
     * Verifica a assinatura e devolve o evento.
     *
     * Recebe o corpo em bruto porque a assinatura cobre os bytes tal como
     * chegaram: qualquer releitura do JSON — reordenar chaves, mudar
     * espaços — invalida-a. É esta verificação que separa um evento do
     * Stripe de um pedido que alguém inventou para se dar premium.
     */
    constructEvent(rawBody: Buffer, signature: string): Stripe.Event;
    readSubscription(subscriptionId: string): Promise<StripePeriod>;
    cancelAtPeriodEnd(subscriptionId: string): Promise<void>;
}

/**
 * Traduz uma subscrição do Stripe para o que a plataforma guarda.
 */
export const toStripePeriod = (
    subscription: Stripe.Subscription,
): StripePeriod => {
    const item = subscription.items.data[0];

    if (!item) {
        throw new BillingError(
            'STRIPE_REQUEST_FAILED',
            'A subscrição do Stripe chegou sem linhas.',
        );
    }

    return {
        subscriptionId: subscription.id,
        customerId:
            typeof subscription.customer === 'string'
                ? subscription.customer
                : subscription.customer.id,
        status: subscription.status,
        /**
         * O período vive na linha da subscrição, e não na subscrição:
         * desde que o Stripe passou a permitir linhas com ciclos
         * diferentes, é aí que as datas estão.
         */
        currentPeriodStart: new Date(item.current_period_start * 1000),
        currentPeriodEnd: new Date(item.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        /**
         * O preço vem da linha da subscrição, e não do catálogo local:
         * o que interessa gravar é o que foi mesmo cobrado, para que o
         * histórico continue exato depois de uma alteração de preços.
         */
        priceCents: item.price.unit_amount ?? 0,
        currency: item.price.currency.toUpperCase(),
    };
};

/**
 * Ligação real ao Stripe.
 *
 * Só é construída quando há configuração. Sem ela a plataforma funciona
 * toda — incluindo a concessão manual de planos —, e o que não existe é
 * a compra pelo próprio.
 */
export const createStripeGateway = (): StripeGateway | null => {
    if (!stripeConfig) {
        return null;
    }

    const config = stripeConfig;

    const stripe = new Stripe(config.secretKey);

    /**
     * Um erro do Stripe não deve sair como 500 com a mensagem crua: o
     * texto pode nomear objetos da conta, e quem faz o pedido não tem
     * nada a fazer com isso.
     */
    const wrap = async <T>(operation: () => Promise<T>): Promise<T> => {
        try {
            return await operation();
        } catch (error: unknown) {
            throw new BillingError(
                'STRIPE_REQUEST_FAILED',
                error instanceof Stripe.errors.StripeError
                    ? `O Stripe recusou o pedido: ${error.type}.`
                    : 'Não foi possível falar com o Stripe.',
            );
        }
    };

    return {
        createCheckoutSession: (request) =>
            wrap(async () => {
                const session = await stripe.checkout.sessions.create({
                    mode: 'subscription',
                    line_items: [{ price: config.priceId, quantity: 1 }],
                    success_url: config.successUrl,
                    cancel_url: config.cancelUrl,
                    ...(request.customerId === undefined
                        ? { customer_email: request.buyerEmail }
                        : { customer: request.customerId }),
                    /**
                     * O titular viaja com a sessão e volta no webhook. É
                     * assim que se sabe a quem dar o plano quando o
                     * pagamento chega: o webhook não traz mais nada que
                     * o ligue a uma crew.
                     */
                    subscription_data: {
                        metadata: {
                            ownerKind: request.ownerKind,
                            ownerId: request.ownerId,
                            buyerId: request.buyerId,
                        },
                    },
                    metadata: {
                        ownerKind: request.ownerKind,
                        ownerId: request.ownerId,
                        buyerId: request.buyerId,
                    },
                });

                if (!session.url) {
                    throw new BillingError(
                        'STRIPE_REQUEST_FAILED',
                        'O Stripe não devolveu um endereço de pagamento.',
                    );
                }

                return { url: session.url };
            }),

        constructEvent: (rawBody, signature) => {
            try {
                return stripe.webhooks.constructEvent(
                    rawBody,
                    signature,
                    config.webhookSecret,
                );
            } catch {
                throw new BillingError(
                    'INVALID_WEBHOOK_SIGNATURE',
                    'A assinatura do evento não confere.',
                );
            }
        },

        readSubscription: (subscriptionId) =>
            wrap(async () =>
                toStripePeriod(await stripe.subscriptions.retrieve(subscriptionId)),
            ),

        cancelAtPeriodEnd: (subscriptionId) =>
            wrap(async () => {
                await stripe.subscriptions.update(subscriptionId, {
                    cancel_at_period_end: true,
                });
            }),
    };
};
