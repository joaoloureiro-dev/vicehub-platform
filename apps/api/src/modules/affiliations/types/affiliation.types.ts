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
