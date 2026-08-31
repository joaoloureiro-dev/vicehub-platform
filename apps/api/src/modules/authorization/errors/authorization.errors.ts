export type AuthorizationErrorCode =
    | 'INSUFFICIENT_PERMISSIONS'
    | 'LAST_ROLE_HOLDER';

/**
 * Erro de domínio do módulo de autorização.
 *
 * É distinto dos erros de autenticação: aqui o utilizador está
 * identificado, apenas não tem autorização para a operação.
 */
export class AuthorizationError extends Error {
    constructor(
        public readonly code: AuthorizationErrorCode,
        message: string,
        public readonly missingPermissions: readonly string[],
    ) {
        super(message);

        this.name = 'AuthorizationError';
    }
}
