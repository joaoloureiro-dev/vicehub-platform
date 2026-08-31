import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

/**
 * Catálogo dos planos do ViceHub.
 *
 * Segue o mesmo princípio do catálogo de cargos: uma única fonte de
 * verdade, no package de dados, para que o preço e as condições que a
 * aplicação usa e o que fica gravado não possam divergir.
 *
 * O preço aqui é o preço em vigor. O preço cobrado em cada período fica
 * gravado na própria subscrição, para que o histórico continue exato
 * depois de uma alteração de preços.
 */

export interface PlanDefinition {
    plan: SubscriptionPlan;
    name: string;
    description: string;
    /** Em cêntimos, para não haver aritmética de vírgula flutuante em dinheiro. */
    priceCents: number;
    currency: string;
    intervalMonths: number;
}

export const PLANS = {
    premium: {
        plan: SubscriptionPlan.premium,
        name: 'Premium',
        description: 'Acesso às funcionalidades premium do ViceHub.',
        priceCents: 1_000,
        currency: 'USD',
        intervalMonths: 1,
    },
} as const satisfies Record<string, PlanDefinition>;

export type PlanKey = keyof typeof PLANS;

export const PLAN_KEYS = Object.keys(PLANS) as PlanKey[];

/**
 * Estados que dão direito às funcionalidades do plano.
 *
 * past_due fica deliberadamente de fora: enquanto o pagamento estiver em
 * falta o acesso não é concedido. Se quisermos um período de tolerância
 * durante a cobrança, é acrescentá-lo a esta lista.
 */
export const ENTITLING_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
    SubscriptionStatus.active,
    SubscriptionStatus.trialing,
];

/**
 * Calcula o fim de um período a partir do seu início.
 */
export const addPlanInterval = (start: Date, plan: PlanDefinition): Date => {
    const end = new Date(start);

    end.setMonth(end.getMonth() + plan.intervalMonths);

    return end;
};
