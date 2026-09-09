export type ServerErrorCode =
    | 'SERVER_NOT_FOUND'
    | 'SERVER_NAME_TAKEN'
    | 'MEMBERSHIP_NOT_FOUND'
    | 'ALREADY_MEMBER'
    | 'NOT_A_MEMBER'
    | 'MEMBERSHIP_NOT_PENDING'
    | 'CANNOT_MANAGE_SELF'
    | 'SERVER_HAS_FUNDS'
    | 'SERVER_HAS_OPEN_DECISIONS'
    | 'SERVER_HAS_ACTIVE_PLAN';

export class ServerError extends Error {
    constructor(
        public readonly code: ServerErrorCode,
        message: string,
    ) {
        super(message);

        this.name = 'ServerError';
    }
}
