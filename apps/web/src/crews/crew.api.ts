import { api } from '../lib/api.js';
import {
    createMembershipApi,
    queryDoDiretorio,
    type CommunityJoinRequest,
    type CommunityMember,
} from '../lib/membership.js';
import type {
    CrewDirectoryEntry,
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

const adesao = createMembershipApi('/crews');

export const listCrews = (
    query: DirectoryQuery = {},
): Promise<DirectoryPage<CrewDirectoryEntry>> =>
    api<DirectoryPage<CrewDirectoryEntry>>(
        `/crews${queryDoDiretorio({ ...query })}`,
    );

export const getCrew = (crewId: string): Promise<CrewProfile> =>
    api<CrewProfile>(`/crews/${crewId}`);

export const listMyMemberships = (): Promise<CrewMembership[]> =>
    api<CrewMembership[]>('/crews/me/memberships');

export const createCrew = (input: {
    name: string;
    tag: string;
    description?: string | null;
}): Promise<CrewProfile> =>
    api<CrewProfile>('/crews', { method: 'POST', body: input });

/* A mecânica de adesão é partilhada com os servidores. */
export const listCrewMembers = (crewId: string): Promise<CommunityMember[]> =>
    adesao.listMembers(crewId);

export const requestToJoin = (crewId: string): Promise<void> =>
    adesao.requestToJoin(crewId);

export const withdrawJoinRequest = (crewId: string): Promise<void> =>
    adesao.withdrawJoinRequest(crewId);

export const leaveCrew = (crewId: string): Promise<void> => adesao.leave(crewId);

export const listJoinRequests = (
    crewId: string,
): Promise<CommunityJoinRequest[]> => adesao.listJoinRequests(crewId);

export const acceptJoinRequest = (
    crewId: string,
    userId: string,
): Promise<void> => adesao.acceptJoinRequest(crewId, userId);

export const rejectJoinRequest = (
    crewId: string,
    userId: string,
): Promise<void> => adesao.rejectJoinRequest(crewId, userId);

export const removeMember = (crewId: string, userId: string): Promise<void> =>
    adesao.removeMember(crewId, userId);

export const setMemberRole = (
    crewId: string,
    userId: string,
    role: CrewRole,
): Promise<void> => adesao.setMemberRole(crewId, userId, role);

/**
 * Personalização da crew: banner e cor de destaque.
 *
 * Exige mandar na crew **e** a crew ter plano ativo, que são duas
 * condições distintas. Sem plano a API responde **402**, e não 403: o
 * pedido é legítimo e quem o faz tem autorização — o que falta é o
 * pagamento.
 */
export const updateCrewAppearance = (
    crewId: string,
    input: { bannerUrl: string | null; accentColor: string | null },
): Promise<CrewProfile> =>
    api<CrewProfile>(`/crews/${encodeURIComponent(crewId)}/appearance`, {
        method: 'PATCH',
        body: input,
    });
