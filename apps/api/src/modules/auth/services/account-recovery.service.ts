import { AccountTokenPurpose } from '@vicehub/database';

import { env } from '../../../config/env.js';
import type { Mailer } from '../../mail/mailer.js';
import { AuthError } from '../errors/auth.errors.js';
import type { AuthRepository } from '../repositories/auth.repository.js';
import type { AccountTokenService } from './account-token.service.js';
import { normalizeEmail } from './email.js';
import type { PasswordService } from './password.service.js';

interface RequestContext {
    ipAddress?: string | null | undefined;
    userAgent?: string | null | undefined;
}

/**
 * Recuperar a password e confirmar o email.
 *
 * As duas coisas partilham a mesma mecânica — um segredo que segue por
 * email, guardado em resumo, de uso único e com prazo — e diferem no que
 * autorizam: um abre a conta, o outro apenas confirma que o endereço é
 * mesmo daquela pessoa.
 */
export class AccountRecoveryService {
    constructor(
        private readonly authRepository: AuthRepository,
        private readonly passwordService: PasswordService,
        private readonly accountTokenService: AccountTokenService,
        private readonly mailer: Mailer,
    ) { }

    /**
     * Pede um link para definir uma password nova.
     *
     * **Não diz se a conta existe.** Quem faz o pedido recebe sempre a
     * mesma resposta, exista ou não. Distinguir os dois casos daria a
     * qualquer pessoa uma forma de descobrir quem está registado — basta
     * experimentar endereços — e essa lista vale dinheiro a quem faz
     * phishing.
     */
    async requestPasswordReset(
        email: string,
        context: RequestContext = {},
    ): Promise<void> {
        const utilizador = await this.authRepository.findUserForRecovery(
            normalizeEmail(email),
        );

        /**
         * Sem conta, ou com a credencial local eliminada, não há nada a
         * enviar — e mesmo assim a resposta ao pedido é a mesma.
         */
        if (
            !utilizador ||
            !utilizador.credentials ||
            utilizador.credentials.is_deleted
        ) {
            return;
        }

        const segredo = await this.issueToken(
            utilizador.id,
            AccountTokenPurpose.password_reset,
            env.PASSWORD_RESET_TTL_SECONDS,
            context,
        );

        const link = this.buildLink('/recuperar-password', segredo);

        const horas = Math.round(env.PASSWORD_RESET_TTL_SECONDS / 3600);

        await this.mailer.send({
            to: utilizador.email,
            subject: 'Recuperar a tua password do ViceHub',
            text: [
                `Olá ${utilizador.username},`,
                '',
                'Alguém pediu para definir uma password nova nesta conta.',
                'Se foste tu, segue este link:',
                '',
                link,
                '',
                `O link serve uma vez e expira dentro de ${horas} hora(s).`,
                '',
                'Se não foste tu, não precisas de fazer nada: a password',
                'atual continua a valer e este link expira sozinho.',
            ].join('\n'),
        });
    }

    /**
     * Define a password nova a partir do link recebido.
     *
     * Ao chegar aqui, três coisas acontecem em conjunto e não podem ser
     * separadas: a password muda, o token deixa de servir, e **todas as
     * sessões abertas caem**. A última é a que mais importa: quem
     * recupera uma conta costuma fazê-lo por desconfiar de que outra
     * pessoa lá entrou, e trocar a password sem expulsar essa pessoa
     * resolveria metade do problema — a pior metade ficava.
     */
    async resetPassword(secret: string, newPassword: string): Promise<void> {
        const token = await this.authRepository.findUsableAccountToken(
            this.accountTokenService.hashSecret(secret),
            AccountTokenPurpose.password_reset,
        );

        /**
         * Um token inexistente, já usado e um expirado dão o mesmo erro.
         * Separá-los diria a quem tenta às cegas qual dos casos acertou.
         */
        if (!token) {
            throw new AuthError(
                'INVALID_ACCOUNT_TOKEN',
                'Este link já não é válido. Pede outro.',
            );
        }

        /**
         * O token é gasto antes de a password mudar: se dois pedidos
         * usarem o mesmo link ao mesmo tempo, só um passa daqui, e o
         * segundo não chega a escrever uma password que ninguém pediu.
         */
        const gasto = await this.authRepository.consumeAccountToken(token.id);

        if (!gasto) {
            throw new AuthError(
                'INVALID_ACCOUNT_TOKEN',
                'Este link já não é válido. Pede outro.',
            );
        }

        const passwordHash = await this.passwordService.hash(newPassword);

        await this.authRepository.updatePasswordHash(token.userId, passwordHash);

        /**
         * Os access tokens já emitidos deixam de valer, e as sessões
         * abertas são revogadas. Sem isto, quem tivesse entrado antes
         * continuaria lá dentro depois da recuperação.
         */
        await this.authRepository.incrementUserTokenVersion(token.userId);
        await this.authRepository.revokeAllUserSessions(token.userId, new Date());
    }

    /**
     * Manda o email que confirma o endereço.
     */
    async requestEmailVerification(
        userId: string,
        context: RequestContext = {},
    ): Promise<void> {
        const utilizador = await this.authRepository.findUserById(userId);

        if (!utilizador) {
            throw new AuthError('USER_NOT_FOUND', 'Utilizador não encontrado.');
        }

        if (utilizador.email_verified_at !== null) {
            throw new AuthError(
                'EMAIL_ALREADY_VERIFIED',
                'Este email já está confirmado.',
            );
        }

        const segredo = await this.issueToken(
            utilizador.id,
            AccountTokenPurpose.email_verification,
            env.EMAIL_VERIFICATION_TTL_SECONDS,
            context,
        );

        const link = this.buildLink('/confirmar-email', segredo);

        await this.mailer.send({
            to: utilizador.email,
            subject: 'Confirma o teu email no ViceHub',
            text: [
                `Olá ${utilizador.username},`,
                '',
                'Confirma que este endereço é mesmo teu:',
                '',
                link,
                '',
                'Se não criaste conta no ViceHub, ignora este email.',
            ].join('\n'),
        });
    }

    /**
     * Confirma o endereço a partir do link recebido.
     *
     * Ao contrário da recuperação, isto não abre a conta a ninguém: só
     * regista que o endereço foi confirmado. Por isso não derruba
     * sessões nem mexe na password.
     */
    async verifyEmail(secret: string): Promise<void> {
        const token = await this.authRepository.findUsableAccountToken(
            this.accountTokenService.hashSecret(secret),
            AccountTokenPurpose.email_verification,
        );

        if (!token) {
            throw new AuthError(
                'INVALID_ACCOUNT_TOKEN',
                'Este link já não é válido. Pede outro.',
            );
        }

        const gasto = await this.authRepository.consumeAccountToken(token.id);

        if (!gasto) {
            throw new AuthError(
                'INVALID_ACCOUNT_TOKEN',
                'Este link já não é válido. Pede outro.',
            );
        }

        await this.authRepository.markEmailVerified(token.userId);
    }

    /**
     * Cria um token, invalidando o que estivesse em aberto.
     */
    private async issueToken(
        userId: string,
        purpose: AccountTokenPurpose,
        ttlSeconds: number,
        context: RequestContext,
    ): Promise<string> {
        /**
         * Pedir um link novo mata o anterior. De outra forma, um email
         * antigo continuaria a servir muito depois de a pessoa ter
         * pedido outro precisamente por desconfiar do primeiro.
         */
        await this.authRepository.invalidateOpenAccountTokens(userId, purpose);

        const segredo = this.accountTokenService.generateSecret();

        await this.authRepository.createAccountToken({
            userId,
            purpose,
            tokenHash: this.accountTokenService.hashSecret(segredo),
            expiresAt: this.accountTokenService.expiresAt(new Date(), ttlSeconds),
            requestedIp: context.ipAddress,
            requestedVia: context.userAgent,
        });

        return segredo;
    }

    /**
     * Monta o endereço que segue no email.
     */
    private buildLink(path: string, secret: string): string {
        const url = new URL(path, env.APP_PUBLIC_URL);

        url.searchParams.set('token', secret);

        return url.toString();
    }
}
