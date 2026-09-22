export type ForumErrorCode =
    | 'TOPIC_NOT_FOUND'
    | 'REPLY_NOT_FOUND'
    | 'TOPIC_LOCKED'
    | 'NOT_YOURS'
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
