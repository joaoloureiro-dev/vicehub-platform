export type AuthErrorCode =
    | 'EMAIL_ALREADY_EXISTS'
    | 'INVALID_CREDENTIALS'
    | 'INVALID_ACCESS_TOKEN'
    | 'INVALID_REFRESH_TOKEN'
    | 'REFRESH_TOKEN_REUSED'
    | 'SESSION_NOT_FOUND'
    | 'USER_NOT_FOUND';

/**
 * Erro de domínio do módulo Auth.
 *
 * Mantemos erros explícitos para evitar lançar mensagens genéricas
 * dentro da camada de autenticação.
 */
export class AuthError extends Error {
    constructor(
        public readonly code: AuthErrorCode,
        message: string,
    ) {
        super(message);

        this.name = 'AuthError';
    }
}
