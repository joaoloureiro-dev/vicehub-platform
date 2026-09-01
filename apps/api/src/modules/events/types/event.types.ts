/**
 * Titular de um evento: exatamente um dos campos é preenchido.
 *
 * A base de dados garante a mesma regra com um CHECK.
 */
export interface EventOwner {
    crewId?: string | undefined;
    serverId?: string | undefined;
}

export type EventOwnerKind = 'crew' | 'server';

export interface EventRecord {
    id: string;
    crewId: string | null;
    serverId: string | null;
    name: string;
    description: string | null;
    status: string;
    starts_at: Date;
    ends_at: Date | null;
    capacity: number | null;
    organizer_id: string | null;
    created_at: Date;
}

export interface EventSummary {
    id: string;
    name: string;
    description: string | null;
    status: string;
    startsAt: Date;
    endsAt: Date | null;
    capacity: number | null;
    organizerId: string | null;
    /** Quantos estão inscritos ou já confirmados: os que ocupam lugar. */
    signedUpCount: number;
    /** Quantos têm presença confirmada, e portanto direito a receber. */
    confirmedCount: number;
    createdAt: Date;
}

export interface EventParticipantEntry {
    userId: string;
    username: string;
    avatarUrl: string | null;
    status: string;
    weight: number;
    confirmedBy: string | null;
    confirmedAt: Date | null;
    signedUpAt: Date;
}

/**
 * Quem participou e com que peso, tal como a tesouraria precisa.
 *
 * É o que liga os dois módulos: sem esta lista, dividir ganhos só podia
 * ser por igual ou por cargo.
 */
export interface ConfirmedParticipant {
    userId: string;
    weight: number;
}
