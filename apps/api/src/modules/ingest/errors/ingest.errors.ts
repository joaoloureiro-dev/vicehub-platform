export type IngestErrorCode =
    | 'SERVER_NOT_FOUND'
    | 'API_KEY_NOT_FOUND'
    /** A chave não existe, está revogada, ou não é o que diz ser. */
    | 'INVALID_API_KEY'
    /** Um servidor não pode ter chaves sem conta: alguém tem de as criar. */
    | 'TOO_MANY_API_KEYS';

export class IngestError extends Error {
    constructor(
        public readonly code: IngestErrorCode,
        message: string,
    ) {
        super(message);

        this.name = 'IngestError';
    }
}
