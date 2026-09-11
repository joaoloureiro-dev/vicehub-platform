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
     * Que espécie de titular compra este plano.
     *
     * É o que impede uma crew de comprar um escalão de servidor e um
     * servidor de comprar o de uma crew — duas compras que a plataforma
     * aceitaria de bom grado e que não davam nada a quem as fizesse. O
     * preço de um servidor vende lugares para crews; a crew não tem
     * onde os pôr.
     *
     * Ausente quer dizer que não se compra: é o vitalício, que é um
     * gesto e se concede à mão.
     */
    ownerKind?: 'crew' | 'server';
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
    /**
     * O plano de uma crew.
     *
     * A chave continua a chamar-se `premium` porque está gravada em
     * todas as linhas de subscrição que já existem, e mudá-la seria
     * reescrever o passado por causa de um nome. O que ela é, é isto: o
     * que uma crew paga para poder mexer no seu dinheiro.
     *
     * Não é um plano de uma pessoa. Durante um tempo pareceu que era —
     * dava para personalizar o perfil — mas a personalização passou a
     * ser de graça para toda a gente, e o que ficou do lado pago é
     * gestão: a tesouraria de uma comunidade. Uma pessoa que comprasse
     * isto para si não comprava nada.
     */
    premium: {
        plan: SubscriptionPlan.premium,
        name: 'Crew',
        description:
            'A tesouraria da crew: propor, aprovar e dividir o que a crew ganha.',
        priceCents: 499,
        currency: 'EUR',
        /** Mensal. É o único período cobrado. */
        intervalMonths: 1,
        ownerKind: 'crew',
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
        ownerKind: 'server',
    },
    server_plus: {
        plan: SubscriptionPlan.server_plus,
        name: 'Servidor +',
        description: 'Para servidores com muitas crews a jogar lá.',
        priceCents: 1_999,
        currency: 'EUR',
        intervalMonths: 1,
        maxCrews: 50,
        ownerKind: 'server',
    },
    server_unlimited: {
        plan: SubscriptionPlan.server_unlimited,
        name: 'Servidor sem limite',
        description: 'Sem limite de crews.',
        priceCents: 9_999,
        currency: 'EUR',
        intervalMonths: 1,
        maxCrews: null,
        ownerKind: 'server',
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
        currency: 'EUR',
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
 * Se este plano se compra, e por quem.
 *
 * A ausência do campo é não: um plano sem titular declarado não entra
 * à venda sozinho. É o contrário do que aqui esteve — antes bastava não
 * dizer nada para um plano aparecer no ecrã de preços, e foi assim que
 * três escalões de servidor estiveram anunciados sem que a cobrança os
 * soubesse cobrar.
 */
export const isPurchasablePlan = (definicao: PlanDefinition): boolean =>
    definicao.ownerKind !== undefined;

/**
 * Os planos que esta espécie de titular pode comprar.
 *
 * Uma crew compra o dela; um servidor compra um escalão. Ninguém compra
 * o do outro: o que um escalão de servidor vende são lugares para
 * crews, e uma crew não tem onde os pôr.
 *
 * Uma pessoa não aparece aqui de propósito — não há plano de pessoa
 * nenhum, e a lista vazia é a resposta certa a "o que posso comprar
 * para mim".
 */
export const plansForOwner = (
    ownerKind: 'user' | 'crew' | 'server',
): readonly PlanKey[] =>
    PLAN_KEYS.filter((key) => planDefinition(key).ownerKind === ownerKind);

/**
 * A definição de um plano, com o tipo largo.
 *
 * `PLANS` é `as const`, o que guarda os literais — e faz com que os
 * planos sem `ownerKind` ou sem `maxCrews` não tenham sequer a
 * propriedade: lê-la é um erro de compilação em vez do `undefined` que
 * se procura. Esta função devolve o mesmo objeto com o tipo declarado,
 * que é o que permite perguntar por um campo opcional sem saber de
 * antemão qual dos planos é.
 */
export const planDefinition = (key: PlanKey): PlanDefinition => PLANS[key];

/**
 * Quantos dias dura a avaliação de uma comunidade acabada de criar.
 *
 * Existe porque um muro sem porta não vende — afasta. A tesouraria é o
 * que a plataforma vende, e ninguém paga por uma coisa que nunca viu a
 * funcionar com o seu próprio dinheiro e a sua própria gente. Trinta
 * dias chegam para uma crew correr eventos, juntar ganhos e dividi-los
 * pelo menos uma vez, que é o ciclo inteiro.
 *
 * Uma vez por comunidade, e na criação. Um plano que acabe não abre
 * outra avaliação: a segunda seria a primeira a não valer nada.
 */
export const DIAS_DE_AVALIACAO = 30;

/**
 * Quando acaba a avaliação de uma comunidade criada agora.
 */
export const fimDaAvaliacao = (inicio: Date = new Date()): Date =>
    new Date(inicio.getTime() + DIAS_DE_AVALIACAO * 24 * 60 * 60 * 1000);

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
 * Estados que dão direito **e foram pagos**.
 *
 * É a lista de cima menos a avaliação. Serve a pergunta "isto foi
 * comprado?", que é diferente de "isto dá acesso?" — e a diferença
 * decide, por exemplo, se uma comunidade se pode apagar: não se destrói
 * o que alguém pagou, mas trancar uma comunidade recém-criada durante
 * trinta dias por causa de uma avaliação seria outra coisa.
 */
export const PAID_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] =
    ENTITLING_SUBSCRIPTION_STATUSES.filter(
        (estado) => estado !== SubscriptionStatus.trialing,
    );

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
