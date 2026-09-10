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
    isRecruiting: boolean;
    recruitingSince: string | null;
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
    /**
     * O que a crew exige a quem se candidata. Null quer dizer que
     * ninguém escreveu nada, e nesse caso o perfil não mostra secção
     * nenhuma: um cabeçalho vazio dizia "não exigimos nada", que é uma
     * afirmação que a crew não fez.
     */
    joinRequirements: string | null;
    /** Se a crew diz, ela própria, que está a recrutar. */
    isRecruiting: boolean;
    /**
     * Desde quando o anúncio está no ar, ou null quando não está.
     *
     * Mostrado a quem lê de propósito: os quadros de recrutamento
     * enchem-se de anúncios que ninguém desligou, e esconder a idade do
     * anúncio não o torna mais verdadeiro.
     */
    recruitingSince: string | null;
    level: number;
    xp: string;
    /** O chão do nível atual e o teto do seguinte, para a barra. */
    levelXp: string;
    nextLevelXp: string | null;
    /** O lugar entre as crews que já ganharam xp. Null: ainda sem lugar. */
    rank: { position: number; of: number } | null;
    influence: number;
    prestige: number;
    isPremium: boolean;
    /**
     * De onde vem o plano, quando não é da própria crew: o servidor onde
     * a crew joga cobre-a com o dele. Null quando o plano é da crew, ou
     * quando não há plano nenhum.
     */
    premiumVia: { kind: 'server'; id: string; name: string } | null;
    appearance: Appearance;
    memberCount: number;
    createdAt: string;
}

/**
 * Um ganho de xp. O evento vem vazio quando já não existe.
 */
export interface CrewXpAward {
    id: string;
    amount: number;
    reason: string;
    /** ISO 8601, como todas as datas que chegam da API. */
    at: string;
    event: { id: string; name: string } | null;
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
    /**
     * `rejected` aparece durante um tempo depois da resposta, e depois
     * some.
     *
     * Antes não aparecia de todo: uma candidatura recusada desaparecia
     * desta lista, e quem se candidatou nunca ficava a saber que tinha
     * sido recusado — ficava à espera de uma resposta que já tinha
     * chegado.
     */
    status: 'pending' | 'active' | 'rejected';
    /** Só existe depois de a candidatura ser aceite. */
    role: string | null;
    since: string;
    /** Quando foi respondida, ou null enquanto estiver por responder. */
    respondedAt: string | null;
    /** O que quem decidiu escreveu, se escreveu alguma coisa. */
    decisionNote: string | null;
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
