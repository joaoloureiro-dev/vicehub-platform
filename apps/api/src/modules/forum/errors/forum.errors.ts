export type ForumErrorCode =
    | 'TOPIC_NOT_FOUND'
    | 'REPLY_NOT_FOUND'
    | 'TOPIC_LOCKED'
    | 'NOT_YOURS';

export class ForumError extends Error {
    constructor(
        public readonly code: ForumErrorCode,
        message: string,
    ) {
        super(message);
        this.name = 'ForumError';
    }
}
