import { api } from '../lib/api.js';

/**
 * Onde uma crew joga, e o que tem por responder.
 *
 * São dois campos e não um porque são dois estados distintos: uma crew
 * com pedido em curso não tem servidor, e uma crew com servidor não tem
 * pedido.
 */
/**
 * Quantas crews um servidor pode ter, e quantas já tem.
 *
 * `limit` a null é sem limite. `used` pode ser maior do que `limit`: o
 * plano pode ter acabado ou descido de escalão, e as crews que já lá
 * jogavam ficam onde estão — nunca se tira uma crew a ninguém por causa
 * de um pagamento.
 */
export interface CrewAllowance {
    used: number;
    limit: number | null;
    canAcceptMore: boolean;
}

export interface CrewAffiliation {
    server: { id: string; name: string } | null;
    pending: { id: string; name: string } | null;
}

export interface ServerAffiliation {
    crewId: string;
    crewName: string;
    crewTag: string;
    status: 'pending' | 'active' | 'rejected' | 'left';
    requestedAt: string;
    respondedAt: string | null;
}

export const getCrewAffiliation = (crewId: string): Promise<CrewAffiliation> =>
    api<CrewAffiliation>(`/crews/${crewId}/affiliation`);

export const requestAffiliation = (
    crewId: string,
    serverId: string,
): Promise<void> =>
    api<void>(`/crews/${crewId}/affiliation`, {
        method: 'POST',
        body: { serverId },
    });

export const cancelAffiliationRequest = (crewId: string): Promise<void> =>
    api<void>(`/crews/${crewId}/affiliation/request`, { method: 'DELETE' });

export const leaveServer = (crewId: string): Promise<void> =>
    api<void>(`/crews/${crewId}/affiliation`, { method: 'DELETE' });

export const listServerCrews = (
    serverId: string,
): Promise<ServerAffiliation[]> =>
    api<ServerAffiliation[]>(`/servers/${serverId}/affiliations`);

export const listAffiliationRequests = (
    serverId: string,
): Promise<ServerAffiliation[]> =>
    api<ServerAffiliation[]>(`/servers/${serverId}/affiliations/requests`);

/**
 * Quantas crews o plano do servidor deixa ter, e quantas já tem.
 *
 * Exige `server:manage`: o escalão que um servidor paga não é assunto de
 * quem passa por lá.
 */
export const getCrewAllowance = (serverId: string): Promise<CrewAllowance> =>
    api<CrewAllowance>(`/servers/${serverId}/affiliations/allowance`);

export const acceptAffiliation = (
    serverId: string,
    crewId: string,
): Promise<void> =>
    api<void>(`/servers/${serverId}/affiliations/${crewId}/accept`, {
        method: 'POST',
    });

export const rejectAffiliation = (
    serverId: string,
    crewId: string,
): Promise<void> =>
    api<void>(`/servers/${serverId}/affiliations/${crewId}/reject`, {
        method: 'POST',
    });

export const removeAffiliation = (
    serverId: string,
    crewId: string,
): Promise<void> =>
    api<void>(`/servers/${serverId}/affiliations/${crewId}`, {
        method: 'DELETE',
    });
