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
    /**
     * Meses de cada período, ou `null` quando o plano não renova.
     *
     * `null` é a forma honesta de dizer "não tem período". Pôr um número
     * enorme faria o vitalício parecer um plano normal com uma data
     * muito longe, e alguém acabaria por lha mostrar.
     */
    intervalMonths: number | null;
}

export const PLANS = {
    premium: {
        plan: SubscriptionPlan.premium,
        name: 'Premium',
        description: 'Acesso às funcionalidades premium do ViceHub.',
        priceCents: 1_000,
        currency: 'USD',
        /** Mensal. É o único período cobrado. */
        intervalMonths: 1,
    },
    lifetime: {
        plan: SubscriptionPlan.lifetime,
        name: 'Vitalício',
        description:
            'Acesso premium que não termina, para quem apoiou a plataforma no princípio.',
        /**
         * Zero, e não o preço do premium: o histórico tem de dizer que
         * não foi cobrado nada, ou uma soma de receita passava a contar
         * dinheiro que nunca entrou.
         */
        priceCents: 0,
        currency: 'USD',
        intervalMonths: null,
    },
} as const satisfies Record<string, PlanDefinition>;

/**
 * Planos que não terminam.
 *
 * A pergunta "isto expira?" é do plano, e não de quem a faz. Espalhá-la
 * por comparações a `lifetime` faria com que um plano novo sem fim
 * ficasse de fora de metade dos sítios.
 */
export const isPerpetualPlan = (plan: SubscriptionPlan): boolean =>
    plan === SubscriptionPlan.lifetime;

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
 * Filtro das subscrições que estão, neste momento, a dar acesso.
 *
 * Vive aqui e não em cada repositório porque a condição é subtil e
 * aparece em cinco consultas: estado que dá direito, não eliminada, e
 * **período por terminar ou sem fim nenhum**. Cinco cópias de uma
 * condição destas divergem à primeira alteração, e a que ficasse para
 * trás daria acesso a quem já não paga ou tirava-o a quem é vitalício.
 */
export const entitlingSubscriptionFilter = (now: Date = new Date()) => ({
    is_deleted: false,
    status: { in: [...ENTITLING_SUBSCRIPTION_STATUSES] },
    OR: [{ current_period_end: null }, { current_period_end: { gt: now } }],
});

/**
 * Calcula o fim de um período a partir do seu início.
 *
 * O dia é limitado ao último dia do mês de destino. Sem isso, somar um
 * mês a 31 de janeiro pediria "31 de fevereiro", que o JavaScript
 * transborda para março — e um período encadeado a partir de um fim de
 * mês ganharia dias a cada renovação, sempre a favor de quem subscreve.
 */
export const addPlanInterval = (start: Date, plan: PlanDefinition): Date => {
    if (plan.intervalMonths === null) {
        throw new Error(
            `[ViceHub Plans] O plano "${plan.plan}" não tem período, por isso não tem fim a calcular.`,
        );
    }

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
