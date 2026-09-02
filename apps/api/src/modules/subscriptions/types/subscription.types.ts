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
    /** Fim do período em vigor, ou null quando não termina. */
    activeUntil: Date | null;
}
