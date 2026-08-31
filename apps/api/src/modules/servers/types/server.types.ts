export interface ServerRecord {
    id: string;
    name: string;
    region: string | null;
    description: string | null;
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
