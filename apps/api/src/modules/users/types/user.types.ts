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
    createdAt: Date;
}

export interface PrivateProfile extends PublicProfile {
    email: string;
    emailVerifiedAt: Date | null;
    lastLoginAt: Date | null;
    premiumUntil: Date | null;
}
