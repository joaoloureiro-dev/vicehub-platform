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

/**
 * Apaga o servidor.
 *
 * Exige `server:manage` — o dono. As mesmas três recusas das crews, e as
 * chaves de ingestão deixam de servir no mesmo instante.
 */
export const deleteServer = (serverId: string): Promise<void> =>
    api<void>(`/servers/${encodeURIComponent(serverId)}`, { method: 'DELETE' });

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

export const requestToJoinServer = (
    id: string,
    message?: string,
): Promise<void> => adesao.requestToJoin(id, message);

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

/**
 * Personalização do servidor: banner e cor de destaque.
 *
 * Exige mandar no servidor **e** o servidor ter plano ativo, que são
 * duas condições distintas. Sem plano a API responde **402**, e não 403:
 * o pedido é legítimo e quem o faz tem autorização — o que falta é o
 * pagamento.
 */
export const updateServerAppearance = (
    serverId: string,
    input: { bannerUrl: string | null; accentColor: string | null },
): Promise<ServerProfile> =>
    api<ServerProfile>(`/servers/${encodeURIComponent(serverId)}/appearance`, {
        method: 'PATCH',
        body: input,
    });

/**
 * Definições do servidor: nome, região, descrição e se está online.
 *
 * Exige `server:manage`. O `isOnline` aparece no perfil e é o que o
 * filtro do diretório usa — sem esta rota alcançável, o estado ficava a
 * dizer sempre o mesmo e ninguém o podia corrigir.
 */
export const updateServer = (
    serverId: string,
    input: {
        name?: string;
        region?: string | null;
        description?: string | null;
        isOnline?: boolean;
    },
): Promise<ServerProfile> =>
    api<ServerProfile>(`/servers/${encodeURIComponent(serverId)}`, {
        method: 'PATCH',
        body: input,
    });

/**
 * Uma chave de API de um servidor, tal como a listagem a mostra.
 *
 * Não traz nada que sirva para a usar: o segredo só existe na resposta
 * que a cria, e nunca mais.
 */
export interface ServerApiKey {
    id: string;
    label: string;
    prefix: string;
    lastUsedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
}

/** O que a criação devolve, e que inclui a chave inteira — uma só vez. */
export interface ServerApiKeyCriada {
    id: string;
    label: string;
    prefix: string;
    createdAt: string;
    key: string;
}

export const listServerApiKeys = (serverId: string): Promise<ServerApiKey[]> =>
    api<ServerApiKey[]>(`/servers/${serverId}/api-keys`);

export const createServerApiKey = (
    serverId: string,
    label: string,
): Promise<ServerApiKeyCriada> =>
    api<ServerApiKeyCriada>(`/servers/${serverId}/api-keys`, {
        method: 'POST',
        body: { label },
    });

export const revokeServerApiKey = (
    serverId: string,
    apiKeyId: string,
): Promise<void> =>
    api<void>(`/servers/${serverId}/api-keys/${apiKeyId}`, {
        method: 'DELETE',
    });
