import { api } from '../lib/api.js';
import type {
    CrewDirectoryEntry,
    CrewJoinRequest,
    CrewMember,
    CrewMembership,
    CrewProfile,
    CrewRole,
    DirectoryPage,
} from './crew.types.js';

export interface DirectoryQuery {
    search?: string;
    page?: number;
    sort?: 'newest' | 'level' | 'name';
}

/**
 * O diretório de crews.
 *
 * Os parâmetros vazios não são enviados: um `search=` vazio no endereço
 * faria a API tratar a pesquisa como existente e esconder os destaques,
 * que só aparecem quando não há pesquisa.
 */
export const listCrews = (
    query: DirectoryQuery = {},
): Promise<DirectoryPage<CrewDirectoryEntry>> => {
    const parametros = new URLSearchParams();

    if (query.search) {
        parametros.set('search', query.search);
    }

    if (query.page && query.page > 1) {
        parametros.set('page', String(query.page));
    }

    if (query.sort) {
        parametros.set('sort', query.sort);
    }

    const cauda = parametros.toString();

    return api<DirectoryPage<CrewDirectoryEntry>>(
        `/crews${cauda ? `?${cauda}` : ''}`,
    );
};

export const getCrew = (crewId: string): Promise<CrewProfile> =>
    api<CrewProfile>(`/crews/${crewId}`);

export const listCrewMembers = (crewId: string): Promise<CrewMember[]> =>
    api<CrewMember[]>(`/crews/${crewId}/members`);

export const listMyMemberships = (): Promise<CrewMembership[]> =>
    api<CrewMembership[]>('/crews/me/memberships');

export const createCrew = (input: {
    name: string;
    tag: string;
    description?: string | null;
}): Promise<CrewProfile> =>
    api<CrewProfile>('/crews', { method: 'POST', body: input });

export const requestToJoin = (crewId: string): Promise<void> =>
    api<void>(`/crews/${crewId}/join`, { method: 'POST' });

export const withdrawJoinRequest = (crewId: string): Promise<void> =>
    api<void>(`/crews/${crewId}/join`, { method: 'DELETE' });

export const leaveCrew = (crewId: string): Promise<void> =>
    api<void>(`/crews/${crewId}/leave`, { method: 'POST' });

/** Só quem gere membros. */
export const listJoinRequests = (crewId: string): Promise<CrewJoinRequest[]> =>
    api<CrewJoinRequest[]>(`/crews/${crewId}/requests`);

export const acceptJoinRequest = (
    crewId: string,
    userId: string,
): Promise<void> =>
    api<void>(`/crews/${crewId}/requests/${userId}/accept`, { method: 'POST' });

export const rejectJoinRequest = (
    crewId: string,
    userId: string,
): Promise<void> =>
    api<void>(`/crews/${crewId}/requests/${userId}/reject`, { method: 'POST' });

export const removeMember = (crewId: string, userId: string): Promise<void> =>
    api<void>(`/crews/${crewId}/members/${userId}`, { method: 'DELETE' });

export const setMemberRole = (
    crewId: string,
    userId: string,
    role: CrewRole,
): Promise<void> =>
    api<void>(`/crews/${crewId}/members/${userId}/role`, {
        method: 'PUT',
        body: { role },
    });
