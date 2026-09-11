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
    /**
     * Entrar por outro sítio — Discord, Google.
     *
     * Os códigos não nomeiam o fornecedor de propósito: quem os lê
     * trata-os da mesma maneira venham de onde vierem, e a mensagem que
     * os acompanha é que diz de quem se trata. Um código por fornecedor
     * obrigava a plataforma toda a crescer uma linha por cada forma de
     * entrar que se acrescentasse.
     */
    /** Esta forma de entrar não está configurada nesta instalação. */
    | 'FEDERATED_NOT_CONFIGURED'
    /** O fornecedor não respondeu, ou demorou demasiado. */
    | 'FEDERATED_UNAVAILABLE'
    /** O fornecedor recusou o código, ou respondeu o que não se esperava. */
    | 'FEDERATED_EXCHANGE_FAILED'
    /** O `state` não corresponde ao que saiu daqui: o pedido não é nosso. */
    | 'FEDERATED_STATE_MISMATCH'
    /**
     * O fornecedor não deu email, ou deu um por confirmar.
     *
     * Sem endereço confirmado não se liga a conta a nenhuma que já
     * exista: bastava registar lá o email de outra pessoa para lhe
     * entrar na conta daqui.
     */
    | 'FEDERATED_EMAIL_UNUSABLE';

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
