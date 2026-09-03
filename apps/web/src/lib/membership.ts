import { ApiError, api } from './api.js';

/**
 * Uma pessoa dentro de uma comunidade — crew ou servidor.
 *
 * As duas partilham a forma porque partilham a mecânica: entra-se por
 * candidatura, alguém responde, e há cargos.
 */
export interface CommunityMember {
    userId: string;
    username: string;
    avatarUrl: string | null;
    role: string | null;
    joinedAt: string;
}

export interface CommunityJoinRequest {
    userId: string;
    username: string;
    avatarUrl: string | null;
    requestedAt: string;
}

export interface CommunityMembership {
    status: 'pending' | 'active';
    role: string | null;
    since: string;
}

/**
 * As chamadas de adesão, que são as mesmas para crews e para servidores.
 *
 * Existem aqui, e não copiadas em cada módulo, porque **decidem
 * permissões**. Duas cópias de lógica de permissões acabam sempre por
 * divergir, e a que divergir em silêncio é a que abre a porta errada.
 * O que muda entre os dois é o prefixo do endereço, e mais nada.
 */
export const createMembershipApi = (base: '/crews' | '/servers') => ({
    listMembers: (id: string): Promise<CommunityMember[]> =>
        api<CommunityMember[]>(`${base}/${id}/members`),

    requestToJoin: (id: string): Promise<void> =>
        api<void>(`${base}/${id}/join`, { method: 'POST' }),

    withdrawJoinRequest: (id: string): Promise<void> =>
        api<void>(`${base}/${id}/join`, { method: 'DELETE' }),

    leave: (id: string): Promise<void> =>
        api<void>(`${base}/${id}/leave`, { method: 'POST' }),

    listJoinRequests: (id: string): Promise<CommunityJoinRequest[]> =>
        api<CommunityJoinRequest[]>(`${base}/${id}/requests`),

    acceptJoinRequest: (id: string, userId: string): Promise<void> =>
        api<void>(`${base}/${id}/requests/${userId}/accept`, { method: 'POST' }),

    rejectJoinRequest: (id: string, userId: string): Promise<void> =>
        api<void>(`${base}/${id}/requests/${userId}/reject`, { method: 'POST' }),

    removeMember: (id: string, userId: string): Promise<void> =>
        api<void>(`${base}/${id}/members/${userId}`, { method: 'DELETE' }),

    /**
     * A rota do cargo é PUT nos dois módulos. Com PATCH a API responde
     * 404, que se lê como "esta comunidade não existe".
     */
    setMemberRole: (id: string, userId: string, role: string): Promise<void> =>
        api<void>(`${base}/${id}/members/${userId}/role`, {
            method: 'PUT',
            body: { role },
        }),
});

/**
 * Descobre se quem está a ver gere membros — perguntando à API.
 *
 * O 403 na lista de candidaturas **é** a resposta, e não uma avaria: só
 * quem gere membros a consegue ler. Deduzir o cargo de outro sítio faria
 * o ecrã mostrar uma permissão que podia não ser a verdadeira; assim, o
 * que aparece é sempre o que a API deixa mesmo fazer.
 *
 * Devolve `null` para "não gere", e a lista para "gere".
 */
export const carregarCandidaturas = async (
    listar: () => Promise<CommunityJoinRequest[]>,
): Promise<CommunityJoinRequest[] | null> => {
    try {
        return await listar();
    } catch (falha) {
        if (falha instanceof ApiError && falha.status === 403) {
            return null;
        }

        throw falha;
    }
};

/**
 * Constrói a query de um diretório.
 *
 * Os parâmetros vazios ou por omissão não são enviados. Um `search=`
 * vazio faria a API tratar a pesquisa como existente, e os lugares de
 * destaque — que só aparecem sem pesquisa — desapareciam sem ninguém
 * ter pesquisado nada.
 */
export const queryDoDiretorio = (valores: Record<string, unknown>): string => {
    const parametros = new URLSearchParams();

    for (const [chave, valor] of Object.entries(valores)) {
        if (valor === undefined || valor === null || valor === '' || valor === false) {
            continue;
        }

        if (chave === 'page' && valor === 1) {
            continue;
        }

        parametros.set(chave, String(valor));
    }

    const cauda = parametros.toString();

    return cauda ? `?${cauda}` : '';
};
