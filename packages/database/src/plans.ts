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
     * Quantas crews podem jogar num servidor com este plano.
     *
     * `null` é sem limite. `undefined` — a ausência do campo — é a
     * resposta certa para os planos que não são de servidor: um plano de
     * uma pessoa não tem opinião nenhuma sobre crews, e pôr-lhe um zero
     * dizia que tem, e que é nenhuma.
     */
    maxCrews?: number | null;
    /**
     * Se este plano pode ser comprado sozinho, no ecrã de preços.
     *
     * A cobrança tem **um** preço configurado, e o checkout vende esse.
     * Anunciar um escalão que ele não sabe cobrar era prometer uma
     * coisa e cobrar outra — o pior erro que uma lista de preços pode
     * ter. Enquanto cada escalão não tiver o seu preço no Stripe e o
     * checkout não souber escolher entre eles, os escalões de servidor
     * concedem-se à mão, como o vitalício.
     *
     * Ausente é comprável: é o caso do premium, e o que menos surpreende
     * quem acrescentar um plano novo sem pensar nisto.
     */
    purchasable?: boolean;
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
    /**
     * Os escalões de um servidor.
     *
     * O que um servidor compra é o direito a ter crews a jogar lá, e é
     * por isso que o preço sobe com o número delas e não com outra
     * coisa qualquer: é a única medida em que um servidor grande custa
     * mais do que um pequeno.
     */
    server_base: {
        plan: SubscriptionPlan.server_base,
        name: 'Servidor',
        description:
            'Tudo o que uma crew tem, para o servidor e para as crews que lá jogam.',
        priceCents: 1_499,
        currency: 'EUR',
        intervalMonths: 1,
        maxCrews: 10,
        purchasable: false,
    },
    server_plus: {
        plan: SubscriptionPlan.server_plus,
        name: 'Servidor +',
        description: 'Para servidores com muitas crews a jogar lá.',
        priceCents: 1_999,
        currency: 'EUR',
        intervalMonths: 1,
        maxCrews: 50,
        purchasable: false,
    },
    server_unlimited: {
        plan: SubscriptionPlan.server_unlimited,
        name: 'Servidor sem limite',
        description: 'Sem limite de crews.',
        priceCents: 9_999,
        currency: 'EUR',
        intervalMonths: 1,
        maxCrews: null,
        purchasable: false,
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

/**
 * Se este plano aparece no ecrã de preços para ser comprado.
 *
 * A ausência do campo é sim: um plano novo entra à venda por omissão, e
 * quem o quiser fora da lista tem de o dizer.
 */
export const isPurchasablePlan = (definicao: PlanDefinition): boolean =>
    definicao.purchasable !== false;

/**
 * Quantas crews pode ter um servidor que não paga nada.
 *
 * O número que decide se o escalão de entrada vende alguma coisa. Três
 * é o suficiente para um servidor ver a plataforma a funcionar de
 * verdade — crews a candidatar-se, a jogar lá, a ser pagas — e pouco
 * para quem cresce. Um servidor que nunca sentiu o mecanismo a
 * funcionar não tem razão nenhuma para o pagar.
 *
 * Zero seria pior do que parece: um servidor sem crews não tem nada
 * para mostrar, e quem chegasse a esse servidor não veria plataforma
 * nenhuma.
 */
export const CREWS_SEM_PLANO = 3;

/**
 * Quantas crews este plano deixa jogar num servidor.
 *
 * `null` quer dizer sem limite. Sem plano — ou com um plano que não é
 * de servidor, como o de uma pessoa que também tem um — vale o que
 * vale para quem não paga.
 */
export const crewAllowance = (plan: SubscriptionPlan | null): number | null => {
    if (plan === null) {
        return CREWS_SEM_PLANO;
    }

    /**
     * O tipo é anotado porque `as const` guarda os literais e os planos
     * sem `maxCrews` não têm sequer a propriedade — sem isto, lê-la era
     * um erro de compilação em vez do `undefined` que se procura.
     */
    const definicao: PlanDefinition | undefined = (
        Object.values(PLANS) as readonly PlanDefinition[]
    ).find((candidato) => candidato.plan === plan);

    /**
     * `undefined` é o plano não ter opinião sobre crews — o de uma
     * pessoa, o vitalício. O vitalício merece nota à parte: é um gesto
     * a quem apoiou a plataforma no princípio, e limitá-lo a três crews
     * seria retirar com uma mão o que se deu com a outra.
     */
    if (definicao === undefined || definicao.maxCrews === undefined) {
        return isPerpetualPlan(plan) ? null : CREWS_SEM_PLANO;
    }

    return definicao.maxCrews;
};

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
