export type TreasuryErrorCode =
    | 'WALLET_NOT_FOUND'
    | 'INVALID_WALLET_OWNER';

export class TreasuryError extends Error {
    constructor(
        public readonly code: TreasuryErrorCode,
        message: string,
    ) {
        super(message);

        this.name = 'TreasuryError';
    }
}
