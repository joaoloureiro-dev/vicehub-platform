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
    /**
     * Se o que dá direito é uma avaliação, e não um plano pago.
     *
     * `isPremium` é verdade nos dois casos, e é suposto ser: uma
     * avaliação dá o mesmo. O que muda é o que o ecrã diz — uma
     * avaliação acaba, e acabar em silêncio era a pior maneira de
     * vender.
     */
    isTrial: boolean;
    activeUntil: string | null;
}

/**
 * O plano de uma crew, para quem a gere.
 *
 * Exige `crew:manage`, e é de propósito: se a crew está em avaliação e
 * quando é que ela acaba diz respeito a quem decide se a paga, e não a
 * quem passa pela página. Um 403 aqui é a resposta — não uma avaria.
 */
export const getCrewSubscription = (
    crewId: string,
): Promise<SubscriptionSummary> =>
    api<SubscriptionSummary>(`/subscriptions/crews/${crewId}`);

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
