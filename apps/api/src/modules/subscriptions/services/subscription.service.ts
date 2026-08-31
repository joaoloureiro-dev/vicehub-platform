import { PLANS, addPlanInterval } from '@vicehub/database';

import { SubscriptionError } from '../errors/subscription.errors.js';
import type { SubscriptionRepository } from '../repositories/subscription.repository.js';
import type {
    SubscriptionEntitlement,
    SubscriptionOwner,
    SubscriptionOwnerKind,
} from '../types/subscription.types.js';

interface GrantInput {
    ownerKind: SubscriptionOwnerKind;
    ownerId: string;
    months?: number | undefined;
    grantedBy: string;
}

/**
 * Serviço de subscrições.
 *
 * Responde a uma pergunta: este titular tem, neste momento, direito às
 * funcionalidades do plano? Não sabe nada de HTTP nem de pagamentos.
 */
export class SubscriptionService {
    constructor(
        private readonly subscriptionRepository: SubscriptionRepository,
    ) { }

    /**
     * Apura o direito de acesso de um titular.
     */
    async getEntitlement(
        owner: SubscriptionOwner,
    ): Promise<SubscriptionEntitlement> {
        this.assertSingleOwner(owner);

        const subscription =
            await this.subscriptionRepository.findEntitlingSubscription(owner);

        return {
            owner,
            isPremium: subscription !== null,
            activeUntil: subscription?.current_period_end ?? null,
        };
    }

    /**
     * Concede um período de plano a um titular.
     *
     * Conceder a quem já tem plano **estende** o que existe em vez de
     * abrir um período paralelo: dois períodos sobrepostos fariam o
     * histórico deixar de dizer por quanto tempo se pagou, que é
     * precisamente o que estes registos existem para responder.
     */
    async grant(input: GrantInput) {
        const owner = this.buildOwner(input.ownerKind, input.ownerId);

        const existe = await this.subscriptionRepository.ownerExists(
            input.ownerKind,
            input.ownerId,
        );

        if (!existe) {
            throw new SubscriptionError(
                'SUBSCRIPTION_OWNER_NOT_FOUND',
                'Não existe utilizador, crew ou servidor com este identificador.',
            );
        }

        const plan = PLANS.premium;

        const atual = await this.subscriptionRepository.findLatestPeriodEnd(owner);

        /**
         * O período novo começa onde o anterior acaba, ou agora se não
         * houver nenhum a decorrer.
         */
        const periodStart = atual?.current_period_end ?? new Date();

        const periodEnd =
            input.months === undefined
                ? addPlanInterval(periodStart, plan)
                : addPlanInterval(periodStart, {
                    ...plan,
                    intervalMonths: input.months,
                });

        return this.subscriptionRepository.createPeriod({
            owner,
            plan: plan.plan,
            priceCents: plan.priceCents,
            currency: plan.currency,
            periodStart,
            periodEnd,
            grantedBy: input.grantedBy,
        });
    }

    /**
     * Marca uma subscrição para não renovar no fim do período.
     */
    async cancelAtPeriodEnd(subscriptionId: string, canceledBy: string) {
        const subscription =
            await this.subscriptionRepository.findById(subscriptionId);

        if (!subscription) {
            throw new SubscriptionError(
                'SUBSCRIPTION_NOT_FOUND',
                'Subscrição não encontrada.',
            );
        }

        if (subscription.cancel_at_period_end) {
            throw new SubscriptionError(
                'SUBSCRIPTION_ALREADY_CANCELED',
                'Esta subscrição já estava marcada para não renovar.',
            );
        }

        return this.subscriptionRepository.markToCancelAtPeriodEnd(
            subscriptionId,
            canceledBy,
        );
    }

    /**
     * Constrói o titular a partir do par tipo e identificador.
     */
    buildOwner(kind: SubscriptionOwnerKind, id: string): SubscriptionOwner {
        if (kind === 'user') {
            return { userId: id };
        }

        return kind === 'crew' ? { crewId: id } : { serverId: id };
    }

    /**
     * Apura em bloco quais dos titulares indicados têm plano ativo.
     *
     * Devolve um conjunto para que quem lista possa perguntar por cada
     * linha sem voltar à base de dados.
     */
    async getEntitledIds(
        kind: 'crew' | 'server',
        ids: string[],
    ): Promise<Set<string>> {
        if (ids.length === 0) {
            return new Set();
        }

        const subscriptions = await this.subscriptionRepository.findEntitledOwnerIds(
            kind,
            ids,
        );

        const entitled = new Set<string>();

        for (const subscription of subscriptions) {
            const id = kind === 'crew' ? subscription.crewId : subscription.serverId;

            if (id !== null) {
                entitled.add(id);
            }
        }

        return entitled;
    }

    /**
     * Devolve o histórico de subscrições de um titular.
     */
    async listHistory(owner: SubscriptionOwner) {
        this.assertSingleOwner(owner);

        return this.subscriptionRepository.listByOwner(owner);
    }

    /**
     * Recusa a operação quando o titular não tem plano ativo.
     */
    assertPremium(entitlement: SubscriptionEntitlement): void {
        if (entitlement.isPremium) {
            return;
        }

        throw new SubscriptionError(
            'SUBSCRIPTION_REQUIRED',
            'Esta funcionalidade requer uma subscrição premium ativa.',
        );
    }

    /**
     * Um titular tem de ser exatamente um: utilizador, crew ou servidor.
     *
     * A base de dados garante a mesma regra com um CHECK. Verificar aqui
     * transforma um erro de programação num erro claro, em vez de numa
     * consulta que devolve silenciosamente o titular errado.
     */
    private assertSingleOwner(owner: SubscriptionOwner): void {
        const provided = [owner.userId, owner.crewId, owner.serverId].filter(
            (value) => value !== undefined && value !== null,
        );

        if (provided.length !== 1) {
            throw new SubscriptionError(
                'INVALID_SUBSCRIPTION_OWNER',
                'Uma subscrição tem exatamente um titular: utilizador, crew ou servidor.',
            );
        }
    }
}
