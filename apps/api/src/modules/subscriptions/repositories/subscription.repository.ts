import { ENTITLING_SUBSCRIPTION_STATUSES, type DatabaseClient } from '@vicehub/database';

import type { SubscriptionOwner } from '../types/subscription.types.js';

/**
 * Repositório do módulo de subscrições.
 */
export class SubscriptionRepository {
    constructor(private readonly database: DatabaseClient) { }

    /**
     * Procura a subscrição que está neste momento a dar acesso.
     *
     * Só conta se o estado der direito ao plano e o período ainda não
     * tiver terminado. Devolve a que expira mais tarde, para o caso de
     * existirem períodos sobrepostos após uma renovação antecipada.
     */
    findEntitlingSubscription(owner: SubscriptionOwner) {
        return this.database.subscription.findFirst({
            where: {
                ...this.ownerFilter(owner),
                is_deleted: false,
                status: {
                    in: [...ENTITLING_SUBSCRIPTION_STATUSES],
                },
                current_period_end: {
                    gt: new Date(),
                },
            },
            orderBy: {
                current_period_end: 'desc',
            },
        });
    }

    /**
     * Lista o histórico de subscrições de um titular, da mais recente
     * para a mais antiga.
     */
    listByOwner(owner: SubscriptionOwner) {
        return this.database.subscription.findMany({
            where: {
                ...this.ownerFilter(owner),
                is_deleted: false,
            },
            orderBy: {
                current_period_start: 'desc',
            },
        });
    }

    /**
     * Filtro pelo titular.
     *
     * Os campos ausentes são fixados a null em vez de omitidos: sem isso,
     * procurar pelo utilizador devolveria também subscrições de crews
     * cujo userId calhasse ser nulo.
     */
    private ownerFilter(owner: SubscriptionOwner) {
        return {
            userId: owner.userId ?? null,
            crewId: owner.crewId ?? null,
            serverId: owner.serverId ?? null,
        };
    }
}
