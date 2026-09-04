import { api } from '../lib/api.js';

/** Um plano tal como aparece a quem ainda não o tem. */
export interface PurchasablePlan {
    key: string;
    name: string;
    description: string;
    /** Em cêntimos, como vem da API. */
    priceCents: number;
    currency: string;
    intervalMonths: number;
}

export interface PlanCatalogue {
    /**
     * Se a cobrança está configurada nesta instalação.
     *
     * Vem antes do clique de propósito: sem isto, o ecrã oferecia um
     * botão que responde 503, e um 503 depois de alguém decidir pagar
     * lê-se como avaria.
     */
    available: boolean;
    plans: PurchasablePlan[];
}

/** Público: um preço é para ser visto antes de haver conta. */
export const getPlans = (): Promise<PlanCatalogue> =>
    api<PlanCatalogue>('/billing/plans');

export interface SubscriptionSummary {
    isPremium: boolean;
    /**
     * Sai à parte do `activeUntil` porque, sem ele, um vitalício ficava
     * indistinguível de quem não tem plano: em ambos os casos não há data.
     */
    isLifetime: boolean;
    activeUntil: string | null;
}

export const getMySubscription = (): Promise<SubscriptionSummary> =>
    api<SubscriptionSummary>('/subscriptions/me');

/**
 * Começa a compra e devolve para onde encaminhar quem a fez.
 *
 * O titular pode ser o próprio, uma crew ou um servidor — quem pode
 * comprometer uma crew a uma cobrança recorrente é decidido na API.
 */
export const startCheckout = (input: {
    ownerKind: 'user' | 'crew' | 'server';
    ownerId: string;
}): Promise<{ url: string }> =>
    api<{ url: string }>('/billing/checkout', { method: 'POST', body: input });
