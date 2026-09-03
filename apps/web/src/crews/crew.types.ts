/**
 * O que a API devolve sobre crews.
 *
 * Escrito à mão a partir do contrato da API e não gerado: são poucos
 * tipos, e um gerador traria uma cadeia de ferramentas inteira para
 * resolver um problema que ainda não temos.
 *
 * O `xp` é `string` de propósito. É `BigInt` na base de dados, o JSON
 * não tem inteiros de precisão arbitrária, e convertê-lo para `number`
 * perderia o valor exato acima dos 9 mil biliões — num sistema com
 * economia, isso é inaceitável.
 */
export interface Appearance {
    bannerUrl: string | null;
    accentColor: string | null;
}

export interface CrewDirectoryEntry {
    id: string;
    name: string;
    tag: string;
    description: string | null;
    level: number;
    memberCount: number;
    isPremium: boolean;
    appearance: Appearance;
    createdAt: string;
}

export interface CrewProfile {
    id: string;
    name: string;
    tag: string;
    description: string | null;
    level: number;
    xp: string;
    influence: number;
    prestige: number;
    isPremium: boolean;
    appearance: Appearance;
    memberCount: number;
    createdAt: string;
}

export interface CrewMember {
    userId: string;
    username: string;
    avatarUrl: string | null;
    role: string | null;
    joinedAt: string;
}

export interface CrewJoinRequest {
    userId: string;
    username: string;
    avatarUrl: string | null;
    requestedAt: string;
}

export interface DirectoryPage<TEntry> {
    items: TEntry[];
    /**
     * Os lugares de destaque vêm à parte da lista, e não misturados com
     * ela. A paginação continua a dizer a verdade, e o destaque pode ser
     * mostrado como destaque em vez de disfarçado de resultado.
     */
    featured: TEntry[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

export interface CrewMembership {
    crewId: string;
    name: string;
    tag: string;
    status: 'pending' | 'active';
    /** Só existe depois de a candidatura ser aceite. */
    role: string | null;
    since: string;
}

export type CrewRole = 'crew_leader' | 'crew_officer' | 'crew_member';

/** Os cargos como se dizem a uma pessoa, e não como se gravam. */
export const NOME_DO_CARGO: Record<string, string> = {
    crew_leader: 'Líder',
    crew_officer: 'Oficial',
    crew_member: 'Membro',
};

export const nomeDoCargo = (role: string | null): string =>
    role === null ? 'Membro' : (NOME_DO_CARGO[role] ?? role);
