export type BillingErrorCode =
    | 'BILLING_NOT_CONFIGURED'
    | 'BILLING_OWNER_NOT_FOUND'
    | 'ALREADY_LIFETIME'
    | 'INVALID_WEBHOOK_SIGNATURE'
    | 'STRIPE_REQUEST_FAILED'
    | 'SUBSCRIPTION_NOT_FROM_STRIPE'
    /** O plano é de uma crew ou de um servidor; para uma pessoa não há nada. */
    | 'PLAN_IS_FOR_COMMUNITIES'
    /**
     * O plano pedido não existe, ou esta instalação ainda não o vende.
     *
     * Os dois casos dão o mesmo código de propósito: para quem clica são
     * a mesma coisa — o que pediu não está à venda — e separá-los só
     * diria a quem tenta às cegas que escalões existem no código sem
     * estarem abertos.
     */
    | 'PLAN_NOT_PURCHASABLE'
    /** O plano é de um servidor e o titular é uma crew, ou ao contrário. */
    | 'PLAN_WRONG_OWNER';

export class BillingError extends Error {
    constructor(
        public readonly code: BillingErrorCode,
        message: string,
    ) {
        super(message);

        this.name = 'BillingError';
    }
}
