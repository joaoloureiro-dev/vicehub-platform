/** Uma crew, como o feed a nomeia. */
export interface ActivityCrew {
    id: string;
    name: string;
    tag: string;
}

/** Uma pessoa, como o feed a nomeia. */
export interface ActivityPerson {
    id: string;
    username: string;
}

/**
 * Uma coisa que aconteceu.
 *
 * O `id` é o da linha de origem, e não um identificador inventado para o
 * feed: é por ele que a mesma coisa vista por dois caminhos — um amigo
 * que entra numa crew minha — aparece uma vez só.
 */
export type ActivityItem =
    | {
        kind: 'crew_event';
        id: string;
        at: Date;
        crew: ActivityCrew;
        /** Ausente quando o evento entretanto foi apagado. */
        event: { id: string; name: string } | null;
        amount: number;
    }
    | {
        kind: 'crew_joined';
        id: string;
        at: Date;
        crew: ActivityCrew;
        person: ActivityPerson;
    }
    | {
        kind: 'friend_joined_crew';
        id: string;
        at: Date;
        crew: ActivityCrew;
        person: ActivityPerson;
    };
