export type MarketErrorCode =
    /** O anúncio não existe, ou foi retirado por quem o escreveu. */
    | 'LISTING_NOT_FOUND'
    | 'SERVER_NOT_FOUND'
    /** Anunciar num servidor onde não se joga. */
    | 'NOT_ON_SERVER'
    | 'NOT_YOURS'
    /** Mexer num anúncio que já saiu da venda. */
    | 'ALREADY_CLOSED'
    /**
     * A conversa não existe — ou existe e não é de quem pergunta.
     *
     * As duas coisas dão o mesmo código de propósito: dizer "existe mas
     * não é contigo" já contava que duas pessoas estão a falar sobre
     * aquele anúncio.
     */
    | 'CONVERSATION_NOT_FOUND'
    | 'MESSAGE_NOT_FOUND'
    /** Falar com o próprio anúncio. Quem pergunta é quem o lê. */
    | 'IS_YOURS';

export class MarketError extends Error {
    constructor(
        public readonly code: MarketErrorCode,
        message: string,
    ) {
        super(message);
        this.name = 'MarketError';
    }
}
