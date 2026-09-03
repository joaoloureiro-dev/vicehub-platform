import type { Appearance, DirectoryPage } from '../crews/crew.types.js';

export type { Appearance, DirectoryPage };

export interface ServerDirectoryEntry {
    id: string;
    name: string;
    region: string | null;
    description: string | null;
    isOnline: boolean;
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
    isOnline: boolean;
    isPremium: boolean;
    appearance: Appearance;
    memberCount: number;
    createdAt: string;
}

export interface ServerMembership {
    serverId: string;
    name: string;
    region: string | null;
    status: 'pending' | 'active';
    role: string | null;
    since: string;
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
