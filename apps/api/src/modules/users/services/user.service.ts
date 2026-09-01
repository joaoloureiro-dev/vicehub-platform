import type { UpdateAppearanceDto } from '../../../shared/appearance.js';
import { visibleAppearance } from '../../../shared/appearance.js';
import { UserError } from '../errors/user.errors.js';
import type { UserRepository } from '../repositories/user.repository.js';
import type { SubscriptionService } from '../../subscriptions/services/subscription.service.js';
import type { PrivateProfile, PublicProfile, UserRecord } from '../types/user.types.js';

interface UpdateProfileInput {
    avatarUrl?: string | null | undefined;
    bio?: string | null | undefined;
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
    ) { }

    /**
     * Perfil público, tal como qualquer pessoa o vê.
     */
    async getPublicProfile(username: string): Promise<PublicProfile> {
        const user = await this.userRepository.findByUsername(username);

        if (!user) {
            throw new UserError('USER_NOT_FOUND', 'Utilizador não encontrado.');
        }

        return this.toPublicProfile(user, await this.isPremium(user.id));
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
            ...this.toPublicProfile(user, entitlement.isPremium),
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
    private toPublicProfile(user: UserRecord, isPremium: boolean): PublicProfile {
        return {
            id: user.id,
            username: user.username,
            avatarUrl: user.avatarUrl,
            bio: user.bio,
            level: user.level,
            xp: user.xp,
            reputation: user.reputation,
            isPremium,
            appearance: visibleAppearance(user, isPremium),
            createdAt: user.created_at,
        };
    }
}
