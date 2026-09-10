import { api } from '../lib/api.js';
import type {
    EventParticipant,
    EventStatus,
    EventSummary,
    PublicEvent,
} from './event.types.js';

/**
 * As rotas de eventos vivem sob o titular: `/events/crews/:crewId` ou
 * `/events/servers/:serverId`. O prefixo é o que diz ao guard de
 * autorização em que âmbito avaliar a permissão.
 */
type Dono = { tipo: 'crews'; id: string } | { tipo: 'servers'; id: string };

const base = (dono: Dono) => `/events/${dono.tipo}/${dono.id}`;

export const listEvents = (
    dono: Dono,
    filtros: { status?: EventStatus; includePast?: boolean } = {},
): Promise<EventSummary[]> => {
    const parametros = new URLSearchParams();

    if (filtros.status) {
        parametros.set('status', filtros.status);
    }

    /**
     * Por omissão a API mostra o que está para vir, que é o que interessa
     * a quem quer participar. O histórico pede-se de propósito, e por
     * isso `false` não é enviado.
     */
    if (filtros.includePast) {
        parametros.set('includePast', 'true');
    }

    const cauda = parametros.toString();

    return api<EventSummary[]>(`${base(dono)}${cauda ? `?${cauda}` : ''}`);
};

export const getEvent = (dono: Dono, eventId: string): Promise<EventSummary> =>
    api<EventSummary>(`${base(dono)}/${eventId}`);

export const createEvent = (
    dono: Dono,
    input: {
        name: string;
        description?: string | null;
        startsAt: string;
        endsAt?: string | null;
        capacity?: number | null;
        isPublic?: boolean;
    },
): Promise<EventSummary> =>
    api<EventSummary>(base(dono), { method: 'POST', body: input });

/**
 * Altera um evento já marcado. Exige `event:manage`.
 *
 * Todos os campos são opcionais, e a API só toca no que lhe chega: um
 * pedido que mude o nome não diz nada sobre quem pode ver o evento.
 */
export const updateEvent = (
    dono: Dono,
    eventId: string,
    input: {
        name?: string;
        description?: string | null;
        startsAt?: string;
        endsAt?: string | null;
        capacity?: number | null;
        isPublic?: boolean;
    },
): Promise<EventSummary> =>
    api<EventSummary>(`${base(dono)}/${eventId}`, {
        method: 'PATCH',
        body: input,
    });

export const setEventStatus = (
    dono: Dono,
    eventId: string,
    status: EventStatus,
): Promise<unknown> =>
    api<unknown>(`${base(dono)}/${eventId}/status`, {
        method: 'POST',
        body: { status },
    });

export const signUp = (dono: Dono, eventId: string): Promise<unknown> =>
    api<unknown>(`${base(dono)}/${eventId}/signup`, { method: 'POST' });

export const withdraw = (dono: Dono, eventId: string): Promise<void> =>
    api<void>(`${base(dono)}/${eventId}/signup`, { method: 'DELETE' });

export const listParticipants = (
    dono: Dono,
    eventId: string,
): Promise<EventParticipant[]> =>
    api<EventParticipant[]>(`${base(dono)}/${eventId}/participants`);

/**
 * Confirma que alguém esteve mesmo lá.
 *
 * **É esta afirmação, e não a inscrição, que dá direito a receber.** O
 * peso distingue a divisão por participação de uma divisão por igual:
 * sem valor, vale um.
 */
export const confirmAttendance = (
    dono: Dono,
    eventId: string,
    userId: string,
    weight?: number,
): Promise<unknown> =>
    api<unknown>(`${base(dono)}/${eventId}/participants/${userId}/confirm`, {
        method: 'POST',
        body: weight === undefined ? {} : { weight },
    });

export const markNoShow = (
    dono: Dono,
    eventId: string,
    userId: string,
): Promise<unknown> =>
    api<unknown>(`${base(dono)}/${eventId}/participants/${userId}/no-show`, {
        method: 'POST',
    });

export type { Dono };

/**
 * A montra: os eventos que as comunidades puseram à porta.
 *
 * É a única leitura de eventos que não exige sessão, e é para isso que
 * existe — quem chega à plataforma pela primeira vez ainda não tem
 * conta, e é essa pessoa que precisa de ver que há coisas a acontecer.
 */
export const listPublicEvents = (limit?: number): Promise<PublicEvent[]> =>
    api<PublicEvent[]>(
        `/events/public${limit === undefined ? '' : `?limit=${limit}`}`,
    );
