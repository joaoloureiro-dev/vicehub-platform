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
