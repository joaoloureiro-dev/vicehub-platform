export type TreasuryErrorCode =
    | 'WALLET_NOT_FOUND'
    | 'INVALID_WALLET_OWNER'
    | 'MOVEMENT_NOT_FOUND'
    | 'MOVEMENT_NOT_PENDING'
    | 'INSUFFICIENT_FUNDS'
    | 'NOT_THE_PROPOSER';

export class TreasuryError extends Error {
    constructor(
        public readonly code: TreasuryErrorCode,
        message: string,
    ) {
        super(message);

        this.name = 'TreasuryError';
    }
}
