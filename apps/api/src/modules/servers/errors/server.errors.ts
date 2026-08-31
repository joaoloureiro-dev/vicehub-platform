export type ServerErrorCode =
    | 'SERVER_NOT_FOUND'
    | 'SERVER_NAME_TAKEN'
    | 'MEMBERSHIP_NOT_FOUND'
    | 'ALREADY_MEMBER'
    | 'NOT_A_MEMBER'
    | 'MEMBERSHIP_NOT_PENDING'
    | 'CANNOT_MANAGE_SELF';

export class ServerError extends Error {
    constructor(
        public readonly code: ServerErrorCode,
        message: string,
    ) {
        super(message);

        this.name = 'ServerError';
    }
}
