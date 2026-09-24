export type ModerationErrorCode =
    /** O que se denunciou não existe, ou já tinha sido retirado. */
    | 'TARGET_NOT_FOUND'
    /** Denunciar o que é nosso. O botão de retirar é que serve. */
    | 'IS_YOURS'
    | 'ALREADY_REPORTED'
    | 'REPORT_NOT_FOUND'
    | 'REPORT_ALREADY_HANDLED';

export class ModerationError extends Error {
    constructor(
        public readonly code: ModerationErrorCode,
        message: string,
    ) {
        super(message);
        this.name = 'ModerationError';
    }
}
