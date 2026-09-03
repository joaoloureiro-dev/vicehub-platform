import { api } from '../lib/api.js';
import {
    createMembershipApi,
    queryDoDiretorio,
    type CommunityJoinRequest,
    type CommunityMember,
} from '../lib/membership.js';
import type {
    DirectoryPage,
    ServerDirectoryEntry,
    ServerMembership,
    ServerProfile,
    ServerRole,
} from './server.types.js';

export interface ServerDirectoryQuery {
    search?: string;
    page?: number;
    sort?: 'newest' | 'name';
    /**
     * A API só entende `true` ou `false` em texto, e o filtro só faz
     * sentido quando está ligado — por isso `false` não é enviado.
     */
    onlineOnly?: boolean;
}

const adesao = createMembershipApi('/servers');

export const listServers = (
    query: ServerDirectoryQuery = {},
): Promise<DirectoryPage<ServerDirectoryEntry>> =>
    api<DirectoryPage<ServerDirectoryEntry>>(
        `/servers${queryDoDiretorio({ ...query })}`,
    );

export const getServer = (serverId: string): Promise<ServerProfile> =>
    api<ServerProfile>(`/servers/${serverId}`);

export const listMyServerMemberships = (): Promise<ServerMembership[]> =>
    api<ServerMembership[]>('/servers/me/memberships');

export const createServer = (input: {
    name: string;
    region?: string | null;
    description?: string | null;
}): Promise<ServerProfile> =>
    api<ServerProfile>('/servers', { method: 'POST', body: input });

export const listServerMembers = (id: string): Promise<CommunityMember[]> =>
    adesao.listMembers(id);

export const requestToJoinServer = (id: string): Promise<void> =>
    adesao.requestToJoin(id);

export const withdrawServerJoinRequest = (id: string): Promise<void> =>
    adesao.withdrawJoinRequest(id);

export const leaveServer = (id: string): Promise<void> => adesao.leave(id);

export const listServerJoinRequests = (
    id: string,
): Promise<CommunityJoinRequest[]> => adesao.listJoinRequests(id);

export const acceptServerJoinRequest = (
    id: string,
    userId: string,
): Promise<void> => adesao.acceptJoinRequest(id, userId);

export const rejectServerJoinRequest = (
    id: string,
    userId: string,
): Promise<void> => adesao.rejectJoinRequest(id, userId);

export const removeServerMember = (id: string, userId: string): Promise<void> =>
    adesao.removeMember(id, userId);

export const setServerMemberRole = (
    id: string,
    userId: string,
    role: ServerRole,
): Promise<void> => adesao.setMemberRole(id, userId, role);
