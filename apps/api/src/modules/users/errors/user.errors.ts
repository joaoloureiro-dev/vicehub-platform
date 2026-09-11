export type UserErrorCode =
    | 'USER_NOT_FOUND'
    /**
     * A confirmação não bate certo.
     *
     * Cobre a password errada e o nome escrito ao lado. É um código só
     * de propósito: separá-los diria a quem tenta às cegas qual das
     * duas metades já acertou.
     */
    | 'ACCOUNT_DELETION_NOT_CONFIRMED'
    /** Há saldo na carteira. Apagar tornava-o inalcançável. */
    | 'ACCOUNT_HAS_FUNDS'
    /**
     * Há comunidades que ficariam sem ninguém a mandar nelas.
     *
     * Passar o cargo a outra pessoa, ou apagar a comunidade, é o que
     * desbloqueia.
     */
    | 'ACCOUNT_LEADS_COMMUNITIES'
    /**
     * Há um plano pago em nome desta conta.
     *
     * Apagar a conta não cancela nada no Stripe: a cobrança continuava
     * a sair de um cartão cujo dono já não tem como a parar aqui.
     */
    | 'ACCOUNT_HAS_ACTIVE_PLAN';

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
