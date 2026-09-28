import type { MembershipStatus } from '@vicehub/database';

/**
 * Uma filiação vista do lado do servidor: que crew é, e em que estado.
 */
export interface AffiliationEntry {
    crewId: string;
    crewName: string;
    crewTag: string;
    status: MembershipStatus;
    requestedAt: Date;
    respondedAt: Date | null;
}

/**
 * Onde uma crew joga, visto do lado da crew.
 *
 * `pedido` é o pedido por responder, e é coisa diferente de `servidor`:
 * uma crew sem servidor pode ter um pedido em curso, e uma crew com
 * servidor não pode ter nenhum.
 */
export interface CrewAffiliation {
    servidor: { id: string; name: string } | null;
    pedido: { id: string; name: string } | null;
}

/**
 * Uma linha do quadro de um servidor.
 *
 * O lugar vem calculado e não é o índice da linha: duas crews com o
 * mesmo xp partilham-no, e a terceira fica em terceiro — que é como se
 * lê uma classificação em qualquer sítio onde se leia uma.
 */
export interface LeaderboardEntry {
    position: number;
    crewId: string;
    crewName: string;
    crewTag: string;
    level: number;
    xp: bigint;
}

/**
 * O quadro de um servidor, uma página de cada vez.
 *
 * `total` é o número de crews que lá jogam, e não o das que já ganharam
 * alguma coisa: um quadro é a lista de quem está, com as que ainda não
 * pontuaram no fim.
 */
export interface Leaderboard {
    entries: LeaderboardEntry[];
    page: number;
    pages: number;
    total: number;
}

/**
 * Quantas crews um servidor pode ter, e quantas já tem.
 *
 * `limit` a null é sem limite. `used` pode ser maior do que `limit`: o
 * plano pode ter acabado ou descido de escalão, e as crews que já lá
 * jogavam ficam onde estão.
 */
export interface CrewAllowance {
    used: number;
    limit: number | null;
    canAcceptMore: boolean;
}
