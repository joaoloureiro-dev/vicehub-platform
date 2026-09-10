import type { Appearance } from '../../../shared/appearance.js';

export interface CrewRecord {
    id: string;
    name: string;
    tag: string;
    description: string | null;
    join_requirements: string | null;
    is_recruiting: boolean;
    recruiting_since: Date | null;
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
    /**
     * O que a crew exige a quem se candidata, escrito por quem manda
     * nela. Null quer dizer que ninguém escreveu nada — e é diferente de
     * texto vazio, que o perfil também não mostra mas que já foi uma
     * decisão de alguém.
     */
    joinRequirements: string | null;
    /** Se a crew diz, ela própria, que está a recrutar. */
    isRecruiting: boolean;
    /**
     * Desde quando o anúncio está no ar, ou null quando não está.
     *
     * Público de propósito. O problema conhecido dos quadros de
     * recrutamento é encherem-se de anúncios que ninguém desligou, e
     * esconder a idade do anúncio não o torna mais verdadeiro — só torna
     * mais difícil dar por isso.
     */
    recruitingSince: Date | null;
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
    /**
     * O que a pessoa escreveu ao candidatar-se, ou null se não escreveu.
     *
     * Null e vazio são estados diferentes: um diz "não quis escrever",
     * o outro seria um campo que alguém preencheu e apagou. Quem decide
     * lê os dois de maneira diferente.
     */
    message: string | null;
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
    isRecruiting: boolean;
    recruitingSince: Date | null;
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
    /**
     * `rejected` só aparece durante um tempo depois da resposta.
     *
     * Antes não aparecia de todo: uma candidatura recusada desaparecia
     * desta lista, e quem se candidatou nunca ficava a saber que tinha
     * sido recusado.
     */
    status: 'pending' | 'active' | 'rejected';
    /** Cargo dentro da crew, que só existe depois de ser aceite. */
    role: string | null;
    since: Date;
    /** Quando foi respondida, ou null enquanto estiver por responder. */
    respondedAt: Date | null;
    /** O que quem decidiu escreveu, se escreveu alguma coisa. */
    decisionNote: string | null;
}
