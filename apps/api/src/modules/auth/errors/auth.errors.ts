export type AuthErrorCode =
    | 'ACCOUNT_LOCKED'
    | 'EMAIL_ALREADY_EXISTS'
    | 'USERNAME_ALREADY_EXISTS'
    | 'INVALID_CREDENTIALS'
    | 'INVALID_ACCESS_TOKEN'
    | 'INVALID_REFRESH_TOKEN'
    | 'REFRESH_TOKEN_REUSED'
    | 'SESSION_NOT_FOUND'
    | 'USER_NOT_FOUND'
    | 'INVALID_ACCOUNT_TOKEN'
    | 'EMAIL_ALREADY_VERIFIED'
    /** Entrar com Discord não está configurado nesta instalação. */
    | 'DISCORD_NOT_CONFIGURED'
    /** O Discord não respondeu, ou demorou demasiado. */
    | 'DISCORD_UNAVAILABLE'
    /** O Discord recusou o código, ou respondeu o que não se esperava. */
    | 'DISCORD_EXCHANGE_FAILED'
    /** O `state` não corresponde ao que saiu daqui: o pedido não é nosso. */
    | 'DISCORD_STATE_MISMATCH'
    /**
     * O Discord não deu email, ou deu um por confirmar.
     *
     * Sem endereço confirmado não se liga a conta a nenhuma que já
     * exista: bastava registar no Discord o email de outra pessoa para
     * lhe entrar na conta daqui.
     */
    | 'DISCORD_EMAIL_UNUSABLE';

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
