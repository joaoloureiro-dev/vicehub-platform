import type { Appearance } from '../crews/crew.types.js';

export type { Appearance };

export interface PublicProfile {
    id: string;
    username: string;
    avatarUrl: string | null;
    bio: string | null;
    level: number;
    /** BigInt na base de dados: chega e fica em texto. */
    xp: string;
    reputation: number;
    isPremium: boolean;
    appearance: Appearance;
    createdAt: string;
}

export interface PrivateProfile extends PublicProfile {
    email: string;
    emailVerifiedAt: string | null;
    lastLoginAt: string | null;
    /**
     * `null` num plano que não termina — é assim que o vitalício se
     * distingue do mensal, e não com uma data no ano 9999.
     */
    premiumUntil: string | null;
}
