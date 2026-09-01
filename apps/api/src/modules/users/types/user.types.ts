import type { Appearance } from '../../../shared/appearance.js';

/**
 * Campos do utilizador que o módulo lê da base de dados.
 *
 * Declarado à parte dos tipos gerados pelo Prisma para que a montagem
 * do perfil dependa apenas do que realmente usa.
 */
export interface UserRecord {
    id: string;
    email: string;
    username: string;
    avatarUrl: string | null;
    bio: string | null;
    banner_url: string | null;
    accent_color: string | null;
    level: number;
    xp: bigint;
    reputation: number;
    email_verified_at: Date | null;
    last_login_at: Date | null;
    created_at: Date;
}

export interface PublicProfile {
    id: string;
    username: string;
    avatarUrl: string | null;
    bio: string | null;
    level: number;
    xp: bigint;
    reputation: number;
    isPremium: boolean;
    /**
     * Personalização, vazia para quem não tem plano ativo. Sai sempre,
     * mesmo vazia, para que quem consome não precise de dois caminhos.
     */
    appearance: Appearance;
    createdAt: Date;
}

export interface PrivateProfile extends PublicProfile {
    email: string;
    emailVerifiedAt: Date | null;
    lastLoginAt: Date | null;
    premiumUntil: Date | null;
}
