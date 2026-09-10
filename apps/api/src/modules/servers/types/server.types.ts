import type { Appearance } from '../../../shared/appearance.js';

export interface ServerRecord {
    id: string;
    name: string;
    region: string | null;
    description: string | null;
    join_requirements: string | null;
    banner_url: string | null;
    accent_color: string | null;
    isOnline: boolean;
    /** O que o servidor reporta de si próprio, quando reporta. */
    last_heartbeat_at: Date | null;
    players_online: number | null;
    created_at: Date;
}

export interface ServerProfile {
    id: string;
    name: string;
    region: string | null;
    description: string | null;
    /**
     * O que o servidor exige a quem se candidata. Null quer dizer que
     * ninguém escreveu nada — e é diferente de texto vazio.
     */
    joinRequirements: string | null;
    isOnline: boolean;
    /**
     * Quantas pessoas o servidor reportou da última vez. Null enquanto
     * ninguém tiver instalado o recurso que reporta.
     */
    playersOnline: number | null;
    /**
     * Se o servidor já reportou por si alguma vez.
     *
     * A partir daí, o estado online vem do relógio e a marca manual
     * deixa de decidir — e um formulário que continuasse a oferecer
     * essa marca estaria a oferecer um botão que não faz nada.
     */
    reportsItself: boolean;
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
    /** O que a pessoa escreveu ao candidatar-se, ou null se não escreveu. */
    message: string | null;
}

export interface ServerDirectoryEntry {
    id: string;
    name: string;
    region: string | null;
    description: string | null;
    isOnline: boolean;
    /**
     * Quantas pessoas o servidor reportou da última vez. Null enquanto
     * ninguém tiver instalado o recurso que reporta.
     */
    playersOnline: number | null;
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
    /** `rejected` só aparece durante um tempo depois da resposta. */
    status: 'pending' | 'active' | 'rejected';
    /** Cargo dentro do servidor, que só existe depois de ser aceite. */
    role: string | null;
    since: Date;
    /** Quando foi respondida, ou null enquanto estiver por responder. */
    respondedAt: Date | null;
    /** O que quem decidiu escreveu, se escreveu alguma coisa. */
    decisionNote: string | null;
}
