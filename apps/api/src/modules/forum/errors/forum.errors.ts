export type ForumErrorCode =
    | 'TOPIC_NOT_FOUND'
    | 'REPLY_NOT_FOUND'
    | 'TOPIC_LOCKED'
    | 'NOT_YOURS'
    /**
     * Marcar a resposta que resolveu é de quem perguntou, e só.
     *
     * Separado de `NOT_YOURS` porque diz outra coisa: ali é "não
     * escreveste isto", aqui é "não perguntaste isto". Um moderador que
     * pudesse marcar estaria a pôr palavras na boca de quem teve o
     * problema.
     */
    | 'NOT_THE_ASKER'
    /** Denunciar o que é nosso. O botão de retirar é que serve. */
    | 'IS_YOURS'
    | 'ALREADY_REPORTED'
    | 'REPORT_NOT_FOUND'
    | 'REPORT_ALREADY_HANDLED';

export class ForumError extends Error {
    constructor(
        public readonly code: ForumErrorCode,
        message: string,
    ) {
        super(message);
        this.name = 'ForumError';
    }
}
