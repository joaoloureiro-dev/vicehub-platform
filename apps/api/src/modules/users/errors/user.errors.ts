export type UserErrorCode = 'USER_NOT_FOUND';

/**
 * Erro de domínio do módulo de utilizadores.
 */
export class UserError extends Error {
    constructor(
        public readonly code: UserErrorCode,
        message: string,
    ) {
        super(message);

        this.name = 'UserError';
    }
}
