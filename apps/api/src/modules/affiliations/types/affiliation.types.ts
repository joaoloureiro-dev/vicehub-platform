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
