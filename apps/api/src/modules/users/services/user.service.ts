import { progressoDeNivel } from '@vicehub/database';

import {
    blocksAccountDeletion,
    type AccountDeletionBlockers,
} from '../../../shared/account-erasure.js';
import type { UpdateAppearanceDto } from '../../../shared/appearance.js';
import { personalAppearance } from '../../../shared/appearance.js';
import type { ConquistaVisivel } from '../../../shared/list-achievements.js';
import { UserError } from '../errors/user.errors.js';
import type { UserRepository } from '../repositories/user.repository.js';
import type { PasswordService } from '../../auth/services/password.service.js';
import type { SubscriptionService } from '../../subscriptions/services/subscription.service.js';
import type { PrivateProfile, PublicProfile, UserRecord } from '../types/user.types.js';

interface UpdateProfileInput {
    avatarUrl?: string | null | undefined;
    bio?: string | null | undefined;
}

/**
 * O que é preciso para apagar a própria conta.
 */
export interface DeleteAccountInput {
    userId: string;
    /**
     * O nome de utilizador, escrito de novo.
     *
     * É o que separa um clique errado de uma decisão. Não protege contra
     * mais nada — quem tem a sessão já sabe o nome —, e não é para isso
     * que lá está: é a password abaixo que trata de quem não devia estar
     * ali.
     */
    confirmation: string;
    /**
     * A password atual, quando a conta tem uma.
     *
     * É o que impede que uma sessão roubada apague a conta de alguém. As
     * contas que entram só pelo Discord ou pela Google não têm password
     * nenhuma para pedir, e para essas a sessão é a única credencial que
     * existe: fingir que se verifica mais alguma coisa seria mentir.
     */
    password?: string | undefined;
}

/**
 * Serviço de perfis de utilizador.
 *
 * Monta as duas vistas do perfil e é o único sítio que decide o que
 * cada uma expõe. Manter essa decisão num só lugar evita que uma rota
 * nova revele por descuido algo que só ao titular diz respeito.
 */
export class UserService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly subscriptionService: SubscriptionService,
        /**
         * Só para confirmar a password de quem se está a apagar. O
         * módulo de perfis não emite credenciais nem sessões; o que
         * precisa do serviço de passwords é esta única pergunta.
         */
        private readonly passwordService: PasswordService,
    ) { }

    /**
     * Apaga a própria conta.
     *
     * Três coisas por ordem, e a ordem importa:
     *
     * 1. **É mesmo esta pessoa, e é mesmo isto que ela quer.** A
     *    password trata do primeiro, o nome escrito de novo trata do
     *    segundo.
     * 2. **Não fica nada preso atrás.** Dinheiro sem dono, uma crew sem
     *    ninguém que a possa gerir, uma cobrança que continua a sair.
     * 3. **Só então se apaga.**
     *
     * A confirmação vem antes dos impedimentos de propósito: a lista de
     * comunidades onde alguém manda diz alguma coisa sobre essa pessoa,
     * e responder com ela a quem não provou ser ela seria contá-lo a
     * quem apanhou a sessão.
     */
    async deleteOwnAccount(input: DeleteAccountInput): Promise<void> {
        const user = await this.userRepository.findById(input.userId);

        if (!user) {
            throw new UserError('USER_NOT_FOUND', 'Utilizador não encontrado.');
        }

        await this.assertConfirmed(user.username, input);

        this.assertNothingLeftBehind(
            await this.userRepository.findAccountDeletionBlockers(input.userId),
        );

        await this.userRepository.eraseAccount(input.userId);
    }

    private async assertConfirmed(
        username: string,
        input: DeleteAccountInput,
    ): Promise<void> {
        const credencial = await this.userRepository.findCredential(
            input.userId,
        );

        /**
         * A password só é exigida a quem tem uma. Exigi-la a quem entra
         * pelo Discord seria pedir uma coisa que não existe, e a única
         * resposta possível a esse pedido era nunca conseguir sair.
         */
        const passwordCerta
            = credencial === null
                || (input.password !== undefined
                    && (await this.passwordService.verify(
                        credencial.password_hash,
                        input.password,
                    )));

        if (!passwordCerta || input.confirmation !== username) {
            throw new UserError(
                'ACCOUNT_DELETION_NOT_CONFIRMED',
                'A confirmação não corresponde. Escreve o teu nome de utilizador e, se tiveres password, a password atual.',
            );
        }
    }

    private assertNothingLeftBehind(
        impedimentos: AccountDeletionBlockers,
    ): void {
        if (!blocksAccountDeletion(impedimentos)) {
            return;
        }

        if (impedimentos.funds !== 0n) {
            throw new UserError(
                'ACCOUNT_HAS_FUNDS',
                'A tua carteira ainda tem saldo. Transfere-o ou gasta-o antes de apagares a conta.',
            );
        }

        if (impedimentos.orphanedCommunities.length > 0) {
            const nomes = impedimentos.orphanedCommunities
                .map((comunidade) => comunidade.name)
                .join(', ');

            throw new UserError(
                'ACCOUNT_LEADS_COMMUNITIES',
                `És a única pessoa que manda em: ${nomes}. Passa o cargo a outra pessoa ou apaga essas comunidades antes de apagares a conta.`,
            );
        }

        throw new UserError(
            'ACCOUNT_HAS_ACTIVE_PLAN',
            'Há um plano pago em teu nome. Cancela-o antes de apagares a conta — apagá-la aqui não pára a cobrança no Stripe.',
        );
    }

    /**
     * Perfil público, tal como qualquer pessoa o vê.
     */
    async getPublicProfile(username: string): Promise<PublicProfile> {
        const user = await this.userRepository.findByUsername(username);

        if (!user) {
            throw new UserError('USER_NOT_FOUND', 'Utilizador não encontrado.');
        }

        /**
         * As conquistas e o plano são pedidos ao mesmo tempo, e não um a
         * seguir ao outro: são duas perguntas independentes, e encadeá-las
         * acrescentava uma ida à base de dados ao tempo de resposta de
         * cada perfil.
         */
        const [premium, conquistas] = await Promise.all([
            this.isPremium(user.id),
            this.userRepository.listAchievements(user.id),
        ]);

        return this.toPublicProfile(user, premium, conquistas);
    }

    /**
     * Perfil do próprio, com email e detalhe da subscrição.
     */
    async getPrivateProfile(userId: string): Promise<PrivateProfile> {
        const user = await this.userRepository.findById(userId);

        if (!user) {
            throw new UserError('USER_NOT_FOUND', 'Utilizador não encontrado.');
        }

        const entitlement = await this.subscriptionService.getEntitlement({
            userId: user.id,
        });

        return {
            ...this.toPublicProfile(
                user,
                entitlement.isPremium,
                await this.userRepository.listAchievements(user.id),
            ),
            email: user.email,
            emailVerifiedAt: user.email_verified_at,
            lastLoginAt: user.last_login_at,
            premiumUntil: entitlement.activeUntil,
        };
    }

    /**
     * Altera os campos de apresentação do próprio perfil.
     */
    async updateProfile(
        userId: string,
        input: UpdateProfileInput,
    ): Promise<PrivateProfile> {
        const user = await this.userRepository.findById(userId);

        if (!user) {
            throw new UserError('USER_NOT_FOUND', 'Utilizador não encontrado.');
        }

        await this.userRepository.updateProfile(userId, input);

        return this.getPrivateProfile(userId);
    }

    /**
     * Altera a personalização do próprio perfil.
     *
     * Quem chega aqui já passou pelo requirePremium da rota. O serviço
     * não volta a apurar o plano: fazê-lo em dois sítios permitiria que
     * discordassem, e a rota é o sítio onde a regra é visível a quem lê.
     */
    async updateAppearance(
        userId: string,
        input: UpdateAppearanceDto,
    ): Promise<PrivateProfile> {
        const user = await this.userRepository.findById(userId);

        if (!user) {
            throw new UserError('USER_NOT_FOUND', 'Utilizador não encontrado.');
        }

        await this.userRepository.updateAppearance(userId, input);

        return this.getPrivateProfile(userId);
    }

    private async isPremium(userId: string): Promise<boolean> {
        const entitlement = await this.subscriptionService.getEntitlement({
            userId,
        });

        return entitlement.isPremium;
    }

    /**
     * Campos visíveis a qualquer pessoa.
     *
     * O que não estiver aqui não sai numa resposta pública, mesmo que
     * exista no registo lido da base de dados.
     */
    private toPublicProfile(
        user: UserRecord,
        isPremium: boolean,
        achievements: ConquistaVisivel[],
    ): PublicProfile {
        /** O nível vem do xp, pela mesma razão que na crew. */
        const progresso = progressoDeNivel(user.xp);

        return {
            id: user.id,
            username: user.username,
            avatarUrl: user.avatarUrl,
            bio: user.bio,
            level: progresso.nivel,
            xp: user.xp,
            levelXp: progresso.xpDoNivelAtual,
            nextLevelXp: progresso.xpDoNivelSeguinte,
            reputation: user.reputation,
            isPremium,
            appearance: personalAppearance(user),
            achievements,
            createdAt: user.created_at,
        };
    }
}
