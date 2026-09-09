import { api } from '../lib/api.js';

interface Crew {
    id: string;
    name: string;
    tag: string;
}

interface Person {
    id: string;
    username: string;
}

/**
 * Uma coisa que aconteceu.
 *
 * Cada linha é uma coisa que já se podia ver navegando: o feed poupa a
 * caminhada, não abre portas.
 */
export type ActivityItem =
    | {
        kind: 'crew_event';
        id: string;
        at: string;
        crew: Crew;
        /** Ausente quando o evento entretanto foi apagado. */
        event: { id: string; name: string } | null;
        amount: number;
    }
    | {
        kind: 'crew_joined';
        id: string;
        at: string;
        crew: Crew;
        person: Person;
    }
    | {
        kind: 'friend_joined_crew';
        id: string;
        at: string;
        crew: Crew;
        person: Person;
    };

export const listActivity = (): Promise<ActivityItem[]> =>
    api<ActivityItem[]>('/activity');
