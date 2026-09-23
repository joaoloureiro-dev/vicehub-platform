export type MarketErrorCode =
    /** O anúncio não existe, ou foi retirado por quem o escreveu. */
    | 'LISTING_NOT_FOUND'
    | 'SERVER_NOT_FOUND'
    /** Anunciar num servidor onde não se joga. */
    | 'NOT_ON_SERVER'
    | 'NOT_YOURS'
    /** Mexer num anúncio que já saiu da venda. */
    | 'ALREADY_CLOSED';

export class MarketError extends Error {
    constructor(
        public readonly code: MarketErrorCode,
        message: string,
    ) {
        super(message);
        this.name = 'MarketError';
    }
}
