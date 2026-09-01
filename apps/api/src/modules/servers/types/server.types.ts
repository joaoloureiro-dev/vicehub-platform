import type { Appearance } from '../../../shared/appearance.js';

export interface ServerRecord {
    id: string;
    name: string;
    region: string | null;
    description: string | null;
    banner_url: string | null;
    accent_color: string | null;
    isOnline: boolean;
    created_at: Date;
}

export interface ServerProfile {
    id: string;
    name: string;
    region: string | null;
    description: string | null;
    isOnline: boolean;
    isPremium: boolean;
    /** Personalização, vazia para quem não tem plano ativo. */
    appearance: Appearance;
    memberCount: number;
    createdAt: Date;
}

export interface ServerMember {
    userId: string;
    username: string;
    avatarUrl: string | null;
    /** Slug do cargo dentro do servidor, quando lhe foi atribuído algum. */
    role: string | null;
    joinedAt: Date;
}

export interface ServerJoinRequest {
    userId: string;
    username: string;
    avatarUrl: string | null;
    requestedAt: Date;
}

export interface ServerDirectoryEntry {
    id: string;
    name: string;
    region: string | null;
    description: string | null;
    isOnline: boolean;
    memberCount: number;
    isPremium: boolean;
    appearance: Appearance;
    createdAt: Date;
}

/**
 * Um servidor do ponto de vista de quem se candidatou ou já pertence.
 */
export interface ServerMembershipSummary {
    serverId: string;
    name: string;
    region: string | null;
    status: 'pending' | 'active';
    /** Cargo dentro do servidor, que só existe depois de ser aceite. */
    role: string | null;
    since: Date;
}
