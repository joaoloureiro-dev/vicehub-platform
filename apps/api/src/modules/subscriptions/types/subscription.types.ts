import type { SubscriptionPlan } from '@vicehub/database';

/**
 * Titular de uma subscrição.
 *
 * Exatamente um dos campos é preenchido. A base de dados garante essa
 * regra com um CHECK; aqui garantimos que não construímos um titular
 * inválido antes sequer de chegar lá.
 */
export interface SubscriptionOwner {
    userId?: string | undefined;
    crewId?: string | undefined;
    serverId?: string | undefined;
}

export type SubscriptionOwnerKind = 'user' | 'crew' | 'server';

/**
 * Direito de acesso apurado num dado momento.
 */
export interface SubscriptionEntitlement {
    owner: SubscriptionOwner;
    isPremium: boolean;
    /**
     * Acesso que não termina.
     *
     * Existe porque `activeUntil: null` é ambíguo sozinho: é o que se vê
     * tanto em quem não tem plano nenhum como em quem tem um vitalício.
     * Sem este campo, quem consome teria de deduzir a diferença a partir
     * do `isPremium`, e mais cedo ou mais tarde alguém deduziria mal.
     */
    isLifetime: boolean;
    /**
     * Qual é o plano em vigor, ou null quando não há nenhum.
     *
     * É diferente de `isPremium`: essa pergunta é "tem alguma coisa?", e
     * esta é "tem qual?". Os escalões de um servidor dão direitos de
     * tamanhos diferentes — quantas crews podem jogar lá — e sem o nome
     * do plano não há como perguntar o tamanho.
     */
    plan: SubscriptionPlan | null;
    /**
     * Se o que está a dar direito é uma avaliação, e não um plano pago.
     *
     * Existe para o ecrã poder dizer a verdade. `isPremium` é o mesmo
     * nos dois casos — e é suposto ser: uma avaliação dá o mesmo que um
     * plano. Mas uma avaliação **acaba**, e acabar em silêncio, com a
     * tesouraria a fechar-se sem aviso, era a pior maneira de vender.
     */
    isTrial: boolean;
    /** Fim do período em vigor, ou null quando não termina. */
    activeUntil: Date | null;
    /**
     * De onde vem o direito, quando não vem do próprio titular.
     *
     * O plano de um servidor cobre as crews que lá jogam. Esse direito é
     * **derivado**: acaba quando o plano do servidor acabar, e acaba
     * também se a crew sair de lá. Por isso `isLifetime` é sempre falso
     * num direito derivado, mesmo que o plano do servidor não termine —
     * o que não termina é o plano do servidor, não o acesso desta crew.
     *
     * Null quando o direito é do próprio titular, ou quando não há
     * direito nenhum.
     */
    via: { kind: 'server'; id: string; name: string } | null;
}
