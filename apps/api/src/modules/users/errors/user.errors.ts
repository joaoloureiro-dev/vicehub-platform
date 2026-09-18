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
        /**
         * Os nomes que a recusa menciona, à parte da frase.
         *
         * A mensagem da API está em português e nunca chega ao ecrã: o
         * ecrã traduz pelo **código**. Mas há recusas cujo detalhe a
         * pessoa precisa de ter — dizer-lhe que ainda manda numa crew
         * sem dizer qual deixa-a à procura, e quem manda em três fica
         * sem saber por onde começar.
         *
         * Por isso os nomes viajam como dados e não dentro do texto. É
         * o mesmo que o `missingPermissions` já faz na recusa por falta
         * de permissões.
         */
        public readonly communities?: readonly string[],
    ) {
        super(message);

        this.name = 'UserError';
    }
}
