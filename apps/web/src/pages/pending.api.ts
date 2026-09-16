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
    /** Respostas às minhas candidaturas que ainda não fui ver. */
    answers: number;
    /**
     * Quando fui ver pela última vez. Serve para marcar as novas sem
     * pedir nada outra vez: a página já tem o `respondedAt` de cada
     * candidatura, e comparar as duas datas chega.
     */
    answersSeenAt: string | null;
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

/**
 * Dizer que já vi as respostas.
 *
 * Quem chama isto tem de voltar a pedir o pendente a seguir — é o que
 * apaga o número da navegação. O contexto trata disso.
 */
export const markAnswersSeen = (): Promise<void> =>
    api<void>('/users/me/pending/answers/seen', { method: 'POST' });
