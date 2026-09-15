import { api } from '../lib/api.js';

/** Uma coisa que está à espera desta pessoa, e onde ela vive. */
export interface PendingItem {
    kind:
    | 'crew_join_request'
    | 'server_join_request'
    | 'affiliation_request'
    | 'treasury_decision';
    communityKind: 'crew' | 'server';
    communityId: string;
    communityName: string;
    count: number;
}

export interface PendingForUser {
    items: PendingItem[];
    friendRequests: number;
    total: number;
}

/**
 * O que está à espera de mim, em toda a plataforma.
 *
 * A API só devolve o que esta pessoa pode mesmo fazer, por isso o que
 * vier daqui pode ir direto para o ecrã sem mais filtros.
 */
export const getPending = (): Promise<PendingForUser> =>
    api<PendingForUser>('/users/me/pending');
