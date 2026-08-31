export type SubscriptionErrorCode =
    | 'SUBSCRIPTION_REQUIRED'
    | 'INVALID_SUBSCRIPTION_OWNER'
    | 'SUBSCRIPTION_OWNER_NOT_FOUND'
    | 'SUBSCRIPTION_NOT_FOUND'
    | 'SUBSCRIPTION_ALREADY_CANCELED';

/**
 * Erro de domínio do módulo de subscrições.
 *
 * SUBSCRIPTION_REQUIRED é distinto de uma falta de permissões: o pedido
 * é legítimo e o utilizador tem o cargo certo, apenas falta o plano.
 */
export class SubscriptionError extends Error {
    constructor(
        public readonly code: SubscriptionErrorCode,
        message: string,
    ) {
        super(message);

        this.name = 'SubscriptionError';
    }
}
