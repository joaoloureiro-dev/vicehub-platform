import type { FastifyReply, FastifyRequest } from 'fastify';

import type { UpdateAppearanceDto } from '../../../shared/appearance.js';
import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import type {
    PrivateProfileDto,
    PublicProfileDto,
    UpdateProfileDto,
    UsernameParamDto,
} from '../dto/user.dto.js';
import type { UserService } from '../services/user.service.js';
import type { PrivateProfile, PublicProfile } from '../types/user.types.js';

/**
 * Controller dos perfis de utilizador.
 */
export class UserController {
    constructor(private readonly userService: UserService) { }

    /**
     * GET /users/:username
     *
     * Perfil público. Não exige autenticação: é o perfil que qualquer
     * pessoa vê, incluindo quem ainda não tem conta.
     */
    async getPublicProfile(
        request: FastifyRequest<{ Params: UsernameParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const profile = await this.userService.getPublicProfile(
            request.params.username,
        );

        reply.send(this.toPublicDto(profile));
    }

    /**
     * GET /users/me
     */
    async getOwnProfile(
        request: FastifyRequest,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        reply.send(
            this.toPrivateDto(await this.userService.getPrivateProfile(user.id)),
        );
    }

    /**
     * PATCH /users/me
     */
    async updateOwnProfile(
        request: FastifyRequest<{ Body: UpdateProfileDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const profile = await this.userService.updateProfile(
            user.id,
            request.body,
        );

        reply.send(this.toPrivateDto(profile));
    }

    /**
     * PATCH /users/me/appearance
     *
     * Rota à parte da alteração de perfil porque a exigência é outra: o
     * plano protege a rota inteira, e juntá-las faria a bio passar a
     * exigir subscrição.
     */
    async updateOwnAppearance(
        request: FastifyRequest<{ Body: UpdateAppearanceDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const profile = await this.userService.updateAppearance(
            user.id,
            request.body,
        );

        reply.send(this.toPrivateDto(profile));
    }

    /**
     * Converte para o formato de transporte.
     *
     * O xp é BigInt e sai como string, para não perder precisão. As
     * datas saem em ISO 8601.
     */
    private toPublicDto(profile: PublicProfile): PublicProfileDto {
        return {
            id: profile.id,
            username: profile.username,
            avatarUrl: profile.avatarUrl,
            bio: profile.bio,
            level: profile.level,
            xp: profile.xp.toString(),
            reputation: profile.reputation,
            isPremium: profile.isPremium,
            appearance: profile.appearance,
            createdAt: profile.createdAt.toISOString(),
        };
    }

    private toPrivateDto(profile: PrivateProfile): PrivateProfileDto {
        return {
            ...this.toPublicDto(profile),
            email: profile.email,
            emailVerifiedAt: profile.emailVerifiedAt?.toISOString() ?? null,
            lastLoginAt: profile.lastLoginAt?.toISOString() ?? null,
            premiumUntil: profile.premiumUntil?.toISOString() ?? null,
        };
    }
}
