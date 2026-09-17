import type { Conquista } from '../components/conquistas.js';
import type { Appearance } from '../crews/crew.types.js';

export type { Appearance };

/**
 * Uma mudança na reputação, como o ecrã dela a recebe.
 *
 * O `amount` vem assinado: uma presença é `1`, uma falta é `-1`. Quem
 * desenha o sinal lê-o daqui em vez de o inferir da razão, para que os
 * dois nunca possam discordar.
 */
export interface ReputationEntry {
    id: string;
    amount: number;
    reason: string;
    at: string;
    event: {
        id: string;
        name: string;
        /** Exatamente um destes vem preenchido. */
        crewId: string | null;
        serverId: string | null;
    } | null;
}

export interface PublicProfile {
    id: string;
    username: string;
    avatarUrl: string | null;
    bio: string | null;
    level: number;
    /** BigInt na base de dados: chega e fica em texto. */
    xp: string;
    /** O chão do nível atual e o teto do seguinte, para a barra. */
    levelXp: string;
    nextLevelXp: string | null;
    reputation: number;
    isPremium: boolean;
    appearance: Appearance;
    /** O que conseguiu, das mais recentes para as mais antigas. */
    achievements: Conquista[];
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
