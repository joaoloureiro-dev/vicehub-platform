import {
    SourceType,
    SubscriptionPlan,
    SubscriptionProvider,
    SubscriptionStatus,
    entitlingSubscriptionFilter,
    isPerpetualPlan,
    type DatabaseClient,
} from '@vicehub/database';

import type { SubscriptionOwner } from '../../subscriptions/types/subscription.types.js';

interface UpsertPeriodInput {
    owner: SubscriptionOwner;
    providerSubscriptionId: string;
    providerCustomerId: string;
    status: SubscriptionStatus;
    priceCents: number;
    currency: string;
    periodStart: Date;
    periodEnd: Date;
    cancelAtPeriodEnd: boolean;
    endedAt?: Date | null | undefined;
}

/**
 * Repositório da cobrança.
 */
export class BillingRepository {
    constructor(private readonly database: DatabaseClient) { }

    /**
     * Regista um evento como recebido, e diz se é a primeira vez.
     *
     * A escrita é a verificação: tentar gravar e apanhar a chave
     * duplicada é o que torna isto seguro com entregas em paralelo. Uma
     * leitura antes da escrita deixaria passar duas cópias do mesmo
     * evento que chegassem ao mesmo tempo, e o cliente ficava com dois
     * períodos por um pagamento.
     */
    async claimEvent(input: {
        id: string;
        type: string;
        payload: unknown;
    }): Promise<boolean> {
        try {
            await this.database.webhookEvent.create({
                data: {
                    id: input.id,
                    type: input.type,
                    provider: SubscriptionProvider.stripe,
                    payload: input.payload as never,
                },
            });

            return true;
        } catch {
            return false;
        }
    }

    markEventProcessed(id: string) {
        return this.database.webhookEvent.update({
            where: { id },
            data: { processed_at: new Date() },
        });
    }

    /**
     * Cria ou atualiza o período que corresponde a uma subscrição do
     * Stripe.
     *
     * A chave é o identificador no Stripe, e não o titular: é a mesma
     * subscrição a ser atualizada ao longo das renovações, e abrir uma
     * linha nova a cada renovação faria o histórico crescer sem que
     * nenhuma delas soubesse da anterior.
     */
    upsertPeriod(input: UpsertPeriodInput) {
        const dados = {
            userId: input.owner.userId ?? null,
            crewId: input.owner.crewId ?? null,
            serverId: input.owner.serverId ?? null,
            plan: SubscriptionPlan.premium,
            status: input.status,
            provider: SubscriptionProvider.stripe,
            price_cents: input.priceCents,
            currency: input.currency,
            current_period_start: input.periodStart,
            current_period_end: input.periodEnd,
            cancel_at_period_end: input.cancelAtPeriodEnd,
            ended_at: input.endedAt ?? null,
            provider_customer_id: input.providerCustomerId,
        };

        return this.database.subscription.upsert({
            where: {
                provider_provider_subscription_id: {
                    provider: SubscriptionProvider.stripe,
                    provider_subscription_id: input.providerSubscriptionId,
                },
            },
            create: {
                ...dados,
                provider_subscription_id: input.providerSubscriptionId,
                source: SourceType.webhook,
            },
            update: { ...dados, version: { increment: 1 } },
        });
    }

    findByProviderSubscriptionId(providerSubscriptionId: string) {
        return this.database.subscription.findFirst({
            where: {
                provider: SubscriptionProvider.stripe,
                provider_subscription_id: providerSubscriptionId,
            },
        });
    }

    /**
     * O cliente que este titular já tem no Stripe, se tiver comprado
     * antes.
     *
     * Reaproveitá-lo evita que a mesma pessoa ou crew acabe com vários
     * clientes na conta do Stripe, cada um com o seu histórico de
     * faturas.
     */
    async findCustomerId(owner: SubscriptionOwner): Promise<string | null> {
        const subscricao = await this.database.subscription.findFirst({
            where: {
                userId: owner.userId ?? null,
                crewId: owner.crewId ?? null,
                serverId: owner.serverId ?? null,
                provider: SubscriptionProvider.stripe,
                provider_customer_id: { not: null },
            },
            orderBy: { created_at: 'desc' },
            select: { provider_customer_id: true },
        });

        return subscricao?.provider_customer_id ?? null;
    }

    /**
     * Se este titular já tem acesso que não termina.
     *
     * Serve para não deixar um vitalício começar a pagar por engano:
     * receber dinheiro por uma coisa que já foi oferecida é a espécie
     * de erro que ninguém repara e toda a gente acha mal.
     */
    async hasPerpetualAccess(owner: SubscriptionOwner): Promise<boolean> {
        const subscricao = await this.database.subscription.findFirst({
            where: {
                userId: owner.userId ?? null,
                crewId: owner.crewId ?? null,
                serverId: owner.serverId ?? null,
                ...entitlingSubscriptionFilter(),
            },
            select: { plan: true },
        });

        return subscricao !== null && isPerpetualPlan(subscricao.plan);
    }

    ownerExists(kind: 'user' | 'crew' | 'server', id: string): Promise<boolean> {
        const where = { id, is_deleted: false };

        const found =
            kind === 'user'
                ? this.database.user.findFirst({ where, select: { id: true } })
                : kind === 'crew'
                    ? this.database.crew.findFirst({ where, select: { id: true } })
                    : this.database.server.findFirst({ where, select: { id: true } });

        return found.then((row) => row !== null);
    }

    findUserEmail(userId: string) {
        return this.database.user.findFirst({
            where: { id: userId, is_deleted: false },
            select: { email: true },
        });
    }
}
