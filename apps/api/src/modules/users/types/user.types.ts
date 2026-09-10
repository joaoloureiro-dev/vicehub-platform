import type { Appearance } from '../../../shared/appearance.js';
import type { ConquistaVisivel } from '../../../shared/list-achievements.js';

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
    /** Sai do xp, sempre — como na crew. */
    level: number;
    xp: bigint;
    /** O xp com que se entrou no nível atual. */
    levelXp: bigint;
    /** O xp que o nível seguinte exige, ou null no topo. */
    nextLevelXp: bigint | null;
    reputation: number;
    isPremium: boolean;
    /**
     * Personalização, vazia para quem não tem plano ativo. Sai sempre,
     * mesmo vazia, para que quem consome não precise de dois caminhos.
     */
    appearance: Appearance;
    /**
     * O que esta pessoa conseguiu, das mais recentes para as mais
     * antigas. Público como o nível: são factos que a plataforma
     * registou, e é isso que os torna dignos de crédito.
     */
    achievements: ConquistaVisivel[];
    createdAt: Date;
}

export interface PrivateProfile extends PublicProfile {
    email: string;
    emailVerifiedAt: Date | null;
    lastLoginAt: Date | null;
    premiumUntil: Date | null;
}
