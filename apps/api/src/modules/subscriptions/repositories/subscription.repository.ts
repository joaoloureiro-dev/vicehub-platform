import {
    ENTITLING_SUBSCRIPTION_STATUSES,
    SourceType,
    entitlingSubscriptionFilter,
    SubscriptionPlan,
    SubscriptionProvider,
    SubscriptionStatus,
    type DatabaseClient,
} from '@vicehub/database';

import type {
    SubscriptionOwner,
    SubscriptionOwnerKind,
} from '../types/subscription.types.js';

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
                ...entitlingSubscriptionFilter(),
            },
            /**
             * Sem fim primeiro: uma subscrição vitalícia ganha a
             * qualquer período com data, por mais longe que ele esteja.
             * A ordenação dos nulos é declarada em vez de herdada do
             * comportamento por omissão da base de dados.
             */
            orderBy: {
                current_period_end: { sort: 'desc', nulls: 'first' },
            },
        });
    }

    /**
     * Apura, de uma só vez, quais dos titulares indicados têm plano ativo.
     *
     * Existe para as listagens: perguntar por cada crew ou servidor da
     * página custaria uma consulta por linha, e o custo cresceria com o
     * tamanho do diretório.
     */
    findEntitledOwnerIds(kind: 'crew' | 'server', ids: string[]) {
        return this.database.subscription.findMany({
            where: {
                ...(kind === 'crew' ? { crewId: { in: ids } } : { serverId: { in: ids } }),
                ...entitlingSubscriptionFilter(),
            },
            select: { crewId: true, serverId: true },
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
     * Confirma que o titular existe e não foi eliminado.
     *
     * A chave estrangeira já impediria uma subscrição órfã, mas rebentaria
     * com um erro de base de dados. Perguntar primeiro devolve um 404 que
     * diz o que se passa.
     */
    ownerExists(kind: SubscriptionOwnerKind, id: string): Promise<boolean> {
        const where = { id, is_deleted: false };

        const found =
            kind === 'user'
                ? this.database.user.findFirst({ where, select: { id: true } })
                : kind === 'crew'
                    ? this.database.crew.findFirst({ where, select: { id: true } })
                    : this.database.server.findFirst({ where, select: { id: true } });

        return found.then((row) => row !== null);
    }

    /**
     * Fim do período mais distante já concedido a este titular.
     *
     * Serve para encadear períodos: conceder a quem já tem plano estende
     * o que existe em vez de abrir um período sobreposto.
     */
    findLatestPeriodEnd(owner: SubscriptionOwner) {
        return this.database.subscription.findFirst({
            where: {
                ...this.ownerFilter(owner),
                ...entitlingSubscriptionFilter(),
            },
            orderBy: {
                current_period_end: { sort: 'desc', nulls: 'first' },
            },
            select: { current_period_end: true, plan: true },
        });
    }

    /**
     * Grava um período de plano.
     *
     * O preço fica gravado na linha, e não lido do catálogo à leitura: o
     * histórico tem de continuar exato depois de uma alteração de preços.
     */
    createPeriod(input: {
        owner: SubscriptionOwner;
        plan: SubscriptionPlan;
        priceCents: number;
        currency: string;
        periodStart: Date;
        /** Ausente no plano vitalício, que não termina. */
        periodEnd: Date | null;
        grantedBy: string;
    }) {
        return this.database.subscription.create({
            data: {
                userId: input.owner.userId ?? null,
                crewId: input.owner.crewId ?? null,
                serverId: input.owner.serverId ?? null,
                plan: input.plan,
                status: SubscriptionStatus.active,
                provider: SubscriptionProvider.manual,
                price_cents: input.priceCents,
                currency: input.currency,
                current_period_start: input.periodStart,
                current_period_end: input.periodEnd,
                source: SourceType.api,
                created_by: input.grantedBy,
            },
        });
    }

    findById(subscriptionId: string) {
        return this.database.subscription.findFirst({
            where: { id: subscriptionId, is_deleted: false },
        });
    }

    /**
     * Marca a subscrição para não renovar.
     *
     * O período em curso mantém-se: quem pagou o mês fica com o mês. Só
     * deixa de haver renovação no fim.
     */
    markToCancelAtPeriodEnd(subscriptionId: string, canceledBy: string) {
        return this.database.subscription.update({
            where: { id: subscriptionId },
            data: {
                cancel_at_period_end: true,
                canceled_at: new Date(),
                updated_by: canceledBy,
                version: { increment: 1 },
            },
        });
    }

    /**
     * Termina uma subscrição já.
     *
     * O registo não é apagado: passa a um estado que não dá acesso e
     * fica com a data em que terminou, para que o histórico continue a
     * dizer que existiu e até quando.
     */
    endNow(subscriptionId: string, revokedBy: string) {
        const agora = new Date();

        return this.database.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: SubscriptionStatus.canceled,
                canceled_at: agora,
                ended_at: agora,
                updated_by: revokedBy,
                version: { increment: 1 },
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
