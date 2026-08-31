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
    /** Fim do período em vigor, quando existe subscrição a dar acesso. */
    activeUntil: Date | null;
}
