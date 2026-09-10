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
    /** Se a comunidade pôs este evento à porta. */
    is_public: boolean;
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
    /** Se a comunidade pôs este evento à porta. */
    isPublic: boolean;
    organizerId: string | null;
    /** Quantos estão inscritos ou já confirmados: os que ocupam lugar. */
    signedUpCount: number;
    /** Quantos têm presença confirmada, e portanto direito a receber. */
    confirmedCount: number;
    createdAt: Date;
}

/**
 * Um evento como a montra pública o mostra.
 *
 * Traz o que serve para decidir se vale a pena ir ver — o que é, quando
 * é, e de quem — e nada mais. Quem se inscreveu continua a ser assunto
 * de dentro: um nome numa lista de participantes não deixa de ser
 * informação de quem pertence só porque o evento é público.
 */
export interface PublicEventEntry {
    id: string;
    name: string;
    status: string;
    startsAt: Date;
    endsAt: Date | null;
    /** A crew ou o servidor que o marcou. */
    owner: {
        kind: EventOwnerKind;
        id: string;
        name: string;
        /** Só as crews têm tag. */
        tag: string | null;
    };
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
