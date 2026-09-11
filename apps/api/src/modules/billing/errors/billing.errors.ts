export type BillingErrorCode =
    | 'BILLING_NOT_CONFIGURED'
    | 'BILLING_OWNER_NOT_FOUND'
    | 'ALREADY_LIFETIME'
    | 'INVALID_WEBHOOK_SIGNATURE'
    | 'STRIPE_REQUEST_FAILED'
    | 'SUBSCRIPTION_NOT_FROM_STRIPE'
    /** O plano é de uma crew ou de um servidor; para uma pessoa não há nada. */
    | 'PLAN_IS_FOR_COMMUNITIES';

export class BillingError extends Error {
    constructor(
        public readonly code: BillingErrorCode,
        message: string,
    ) {
        super(message);

        this.name = 'BillingError';
    }
}
