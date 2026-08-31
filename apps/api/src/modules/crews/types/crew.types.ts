export interface CrewRecord {
    id: string;
    name: string;
    tag: string;
    description: string | null;
    level: number;
    xp: bigint;
    influence: number;
    prestige: number;
    created_at: Date;
}

export interface CrewProfile {
    id: string;
    name: string;
    tag: string;
    description: string | null;
    level: number;
    xp: bigint;
    influence: number;
    prestige: number;
    isPremium: boolean;
    memberCount: number;
    createdAt: Date;
}

export interface CrewMember {
    userId: string;
    username: string;
    avatarUrl: string | null;
    /** Slug do cargo dentro da crew, quando lhe foi atribuído algum. */
    role: string | null;
    joinedAt: Date;
}

export interface CrewJoinRequest {
    userId: string;
    username: string;
    avatarUrl: string | null;
    requestedAt: Date;
}

export interface CrewDirectoryEntry {
    id: string;
    name: string;
    tag: string;
    description: string | null;
    level: number;
    memberCount: number;
    isPremium: boolean;
    createdAt: Date;
}

export interface DirectoryPage<TEntry> {
    items: TEntry[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

/**
 * Uma crew do ponto de vista de quem se candidatou ou já pertence.
 *
 * Existe para que a candidatura seja acompanhável a partir do ViceHub:
 * sem isto, quem pede entrada não tem como saber se já foi respondido.
 */
export interface CrewMembershipSummary {
    crewId: string;
    name: string;
    tag: string;
    status: 'pending' | 'active';
    /** Cargo dentro da crew, que só existe depois de ser aceite. */
    role: string | null;
    since: Date;
}
