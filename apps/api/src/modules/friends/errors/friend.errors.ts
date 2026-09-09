export type FriendErrorCode =
    | 'USER_NOT_FOUND'
    /** Ninguém é amigo de si próprio. A base também o impede. */
    | 'CANNOT_FRIEND_SELF'
    | 'ALREADY_FRIENDS'
    /** Já pedi a esta pessoa e ela ainda não respondeu. */
    | 'ALREADY_REQUESTED'
    | 'FRIENDSHIP_NOT_FOUND'
    | 'FRIENDSHIP_NOT_PENDING'
    /** Quem pede não se aceita a si próprio. */
    | 'CANNOT_ACCEPT_OWN_REQUEST';

export class FriendError extends Error {
    constructor(
        public readonly code: FriendErrorCode,
        message: string,
    ) {
        super(message);

        this.name = 'FriendError';
    }
}
