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
    CrewXpAward,
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

/**
 * Apaga a crew.
 *
 * Exige `crew:manage` — o cargo de líder. A API recusa com 409 enquanto
 * a tesouraria tiver saldo, houver decisões por tomar ou o plano estiver
 * ativo, e o código do erro diz qual das três é.
 */
export const deleteCrew = (crewId: string): Promise<void> =>
    api<void>(`/crews/${encodeURIComponent(crewId)}`, { method: 'DELETE' });

/**
 * De onde veio o xp da crew.
 *
 * Exige `event:read` — pertencer à crew. Quem não pertence leva 403, e
 * é assim que o ecrã sabe que não deve mostrar a secção.
 */
export const listCrewXp = (crewId: string): Promise<CrewXpAward[]> =>
    api<CrewXpAward[]>(`/crews/${encodeURIComponent(crewId)}/xp`);

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

/**
 * Definições da crew: nome e descrição.
 *
 * Exige `crew:manage`. Os campos são opcionais e a descrição é anulável:
 * não indicar um campo deixa-o como está, indicá-lo a null limpa-o —
 * sem essa distinção não havia forma de apagar uma descrição depois de
 * a ter escrito.
 */
export const updateCrew = (
    crewId: string,
    input: { name?: string; description?: string | null },
): Promise<CrewProfile> =>
    api<CrewProfile>(`/crews/${encodeURIComponent(crewId)}`, {
        method: 'PATCH',
        body: input,
    });
