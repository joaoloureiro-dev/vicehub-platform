import type { Appearance, DirectoryPage } from '../crews/crew.types.js';

export type { Appearance, DirectoryPage };

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
    createdAt: string;
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
     * Se o servidor já reportou por si. A partir daí, o estado online
     * vem do último sinal e não da marca manual.
     */
    reportsItself: boolean;
    isPremium: boolean;
    appearance: Appearance;
    memberCount: number;
    createdAt: string;
}

export interface ServerMembership {
    serverId: string;
    name: string;
    region: string | null;
    /** `rejected` aparece durante um tempo depois da resposta. */
    status: 'pending' | 'active' | 'rejected';
    role: string | null;
    since: string;
    /** Quando foi respondida, ou null enquanto estiver por responder. */
    respondedAt: string | null;
    /** O que quem decidiu escreveu, se escreveu alguma coisa. */
    decisionNote: string | null;
}

export type ServerRole = 'server_owner' | 'server_moderator' | 'server_member';

/**
 * Os cargos de um servidor são outros: quem tem um servidor é dono, não
 * líder, e quem ajuda a mantê-lo é moderador.
 */
const NOME_DO_CARGO: Record<string, string> = {
    server_owner: 'Dono',
    server_moderator: 'Moderador',
    server_member: 'Membro',
};

export const nomeDoCargo = (role: string | null): string =>
    role === null ? 'Membro' : (NOME_DO_CARGO[role] ?? role);
