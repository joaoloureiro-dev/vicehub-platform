export type TreasuryErrorCode =
    | 'WALLET_NOT_FOUND'
    | 'INVALID_WALLET_OWNER'
    | 'MOVEMENT_NOT_FOUND'
    | 'MOVEMENT_NOT_PENDING'
    | 'INSUFFICIENT_FUNDS'
    | 'NOT_THE_PROPOSER'
    | 'DISTRIBUTION_NOT_FOUND'
    | 'DISTRIBUTION_NOT_PENDING'
    | 'NO_MEMBERS_TO_PAY'
    | 'EVENT_NOT_IN_THIS_TREASURY'
    | 'NO_CONFIRMED_PARTICIPANTS'
    | 'SHARES_DO_NOT_MATCH_TOTAL';

export class TreasuryError extends Error {
    constructor(
        public readonly code: TreasuryErrorCode,
        message: string,
    ) {
        super(message);

        this.name = 'TreasuryError';
    }
}
