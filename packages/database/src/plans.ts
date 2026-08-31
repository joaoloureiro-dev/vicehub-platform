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
 *
 * O dia é limitado ao último dia do mês de destino. Sem isso, somar um
 * mês a 31 de janeiro pediria "31 de fevereiro", que o JavaScript
 * transborda para março — e um período encadeado a partir de um fim de
 * mês ganharia dias a cada renovação, sempre a favor de quem subscreve.
 */
export const addPlanInterval = (start: Date, plan: PlanDefinition): Date => {
    const end = new Date(start);

    const diaPretendido = end.getDate();

    /**
     * Fixar o dia 1 antes de mudar de mês evita o transbordo durante o
     * próprio cálculo, que de outra forma saltaria um mês inteiro.
     */
    end.setDate(1);
    end.setMonth(end.getMonth() + plan.intervalMonths);

    /**
     * O dia 0 do mês seguinte é o último dia deste.
     */
    const ultimoDiaDoMes = new Date(
        end.getFullYear(),
        end.getMonth() + 1,
        0,
    ).getDate();

    end.setDate(Math.min(diaPretendido, ultimoDiaDoMes));

    return end;
};
