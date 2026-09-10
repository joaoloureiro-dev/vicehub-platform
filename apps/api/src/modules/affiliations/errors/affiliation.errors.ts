export type AffiliationErrorCode =
    | 'AFFILIATION_NOT_FOUND'
    | 'CREW_NOT_FOUND'
    | 'SERVER_NOT_FOUND'
    /** A crew já joga num servidor: mudar exige sair primeiro. */
    | 'CREW_ALREADY_AFFILIATED'
    /** Já há um pedido por responder a este servidor. */
    | 'AFFILIATION_ALREADY_REQUESTED'
    | 'AFFILIATION_NOT_PENDING'
    /** O servidor já tem tantas crews quantas o plano dele permite. */
    | 'SERVER_CREW_LIMIT_REACHED';

export class AffiliationError extends Error {
    constructor(
        public readonly code: AffiliationErrorCode,
        message: string,
    ) {
        super(message);

        this.name = 'AffiliationError';
    }
}
