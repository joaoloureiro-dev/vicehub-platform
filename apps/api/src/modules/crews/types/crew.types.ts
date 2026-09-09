import type { Appearance } from '../../../shared/appearance.js';

export interface CrewRecord {
    id: string;
    name: string;
    tag: string;
    description: string | null;
    banner_url: string | null;
    accent_color: string | null;
    level: number;
    xp: bigint;
    influence: number;
    prestige: number;
    created_at: Date;
}

export interface CrewProfile {
    id: string;
    name: string;
    tag: string;
    description: string | null;
    /** Sai do xp, sempre. A coluna guardada é a mesma conta, para ordenar. */
    level: number;
    xp: bigint;
    /** O xp com que se entrou no nível atual. */
    levelXp: bigint;
    /**
     * O lugar entre as crews que já ganharam xp, ou null.
     *
     * Null quer dizer "ainda sem lugar", e não "último": uma crew que
     * ainda não ganhou nada não está mal classificada — não entrou.
     */
    rank: { position: number; of: number } | null;
    /** O xp que o nível seguinte exige, ou null no topo. */
    nextLevelXp: bigint | null;
    influence: number;
    prestige: number;
    isPremium: boolean;
    /**
     * De onde vem o plano, quando não é da própria crew.
     *
     * O plano de um servidor cobre as crews que lá jogam, e sem isto o
     * perfil dizia "tem plano" sem dizer de quem — e ao sair do servidor
     * a crew perdia-o sem perceber porquê. Não revela nada de novo: que
     * a crew joga naquele servidor já é público, e que o servidor tem
     * plano também.
     */
    premiumVia: { kind: 'server'; id: string; name: string } | null;
    /** Personalização, vazia para quem não tem plano ativo. */
    appearance: Appearance;
    memberCount: number;
    createdAt: Date;
}

export interface CrewMember {
    userId: string;
    username: string;
    avatarUrl: string | null;
    /** Slug do cargo dentro da crew, quando lhe foi atribuído algum. */
    role: string | null;
    joinedAt: Date;
}

export interface CrewJoinRequest {
    userId: string;
    username: string;
    avatarUrl: string | null;
    requestedAt: Date;
}

/**
 * Um ganho de xp, como o ecrã o mostra.
 *
 * O evento pode vir vazio: apagar um evento não apaga o xp que ele deu
 * — o que aconteceu, aconteceu — mas deixa de haver para onde apontar.
 */
export interface CrewXpAward {
    id: string;
    amount: number;
    reason: string;
    at: Date;
    event: { id: string; name: string } | null;
}

export interface CrewDirectoryEntry {
    id: string;
    name: string;
    tag: string;
    description: string | null;
    level: number;
    memberCount: number;
    isPremium: boolean;
    appearance: Appearance;
    createdAt: Date;
}

export interface DirectoryPage<TEntry> {
    items: TEntry[];
    /**
     * Lugares de destaque, uma das funcionalidades do plano.
     *
     * Vêm à parte da lista em vez de misturados com ela: assim a
     * paginação continua a dizer a verdade, e quem consome consegue
     * mostrar o destaque como destaque em vez de o disfarçar de
     * resultado. Só vêm preenchidos na primeira página e sem pesquisa —
     * uma pesquisa é uma intenção concreta, e responder-lhe com
     * colocação paga tornaria os resultados pouco fiáveis.
     */
    featured: TEntry[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

/**
 * Uma crew do ponto de vista de quem se candidatou ou já pertence.
 *
 * Existe para que a candidatura seja acompanhável a partir do ViceHub:
 * sem isto, quem pede entrada não tem como saber se já foi respondido.
 */
export interface CrewMembershipSummary {
    crewId: string;
    name: string;
    tag: string;
    status: 'pending' | 'active';
    /** Cargo dentro da crew, que só existe depois de ser aceite. */
    role: string | null;
    since: Date;
}
