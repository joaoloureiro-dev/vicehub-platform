import {
    PLANS,
    SubscriptionPlan,
    addPlanInterval,
    isPerpetualPlan,
} from '@vicehub/database';

import { SubscriptionError } from '../errors/subscription.errors.js';
import type { SubscriptionRepository } from '../repositories/subscription.repository.js';
import type { PlanKey } from '@vicehub/database';
import type {
    SubscriptionEntitlement,
    SubscriptionOwner,
    SubscriptionOwnerKind,
} from '../types/subscription.types.js';

interface GrantInput {
    ownerKind: SubscriptionOwnerKind;
    ownerId: string;
    months?: number | undefined;
    /**
     * O plano a conceder. Por omissão o premium, que é o caso normal;
     * o vitalício é o gesto excecional e por isso pede-se pelo nome.
     */
    plan?: PlanKey | undefined;
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
            isLifetime:
                subscription !== null && isPerpetualPlan(subscription.plan),
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

        const plan = PLANS[input.plan ?? 'premium'];

        /**
         * Um plano que não termina não se encadeia nem se mede em meses:
         * pedir uma duração para ele é um mal-entendido que vale a pena
         * recusar em vez de ignorar em silêncio.
         */
        if (isPerpetualPlan(plan.plan)) {
            if (input.months !== undefined) {
                throw new SubscriptionError(
                    'LIFETIME_HAS_NO_DURATION',
                    'Uma subscrição vitalícia não termina, por isso não leva duração.',
                );
            }

            return this.subscriptionRepository.createPeriod({
                owner,
                plan: plan.plan,
                priceCents: plan.priceCents,
                currency: plan.currency,
                periodStart: new Date(),
                periodEnd: null,
                grantedBy: input.grantedBy,
            });
        }

        const atual = await this.subscriptionRepository.findLatestPeriodEnd(owner);

        /**
         * Conceder tempo a quem já é vitalício não acrescenta nada e
         * deixaria no histórico um período que nunca chega a dar acesso
         * — o vitalício já o dá. Recusar diz a quem concede que o gesto
         * era desnecessário, em vez de o deixar a achar que resultou.
         */
        if (atual && isPerpetualPlan(atual.plan)) {
            throw new SubscriptionError(
                'ALREADY_LIFETIME',
                'Este titular já tem acesso vitalício, que não precisa de ser estendido.',
            );
        }

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

        /**
         * Marcar para não renovar não faz nada a um plano que não
         * renova: a subscrição ficaria com a marca e o acesso continuava
         * para sempre, dando a quem cancelou a ideia errada de que a
         * tinha terminado. Para retirar um vitalício existe o revoke.
         */
        if (isPerpetualPlan(subscription.plan)) {
            throw new SubscriptionError(
                'LIFETIME_CANNOT_BE_CANCELED',
                'Uma subscrição vitalícia não renova; para a retirar usa a revogação.',
            );
        }

        return this.subscriptionRepository.markToCancelAtPeriodEnd(
            subscriptionId,
            canceledBy,
        );
    }

    /**
     * Retira uma subscrição com efeito imediato.
     *
     * É o contrário de conceder, e existe sobretudo por causa do
     * vitalício: sem isto, um acesso oferecido por engano — ou a quem
     * depois abusa da plataforma — não teria como ser retirado, porque
     * não há período para deixar acabar.
     *
     * O registo não é apagado: fica com o fim marcado, para que o
     * histórico continue a dizer que existiu e até quando.
     */
    async revoke(subscriptionId: string, revokedBy: string) {
        const subscription =
            await this.subscriptionRepository.findById(subscriptionId);

        if (!subscription) {
            throw new SubscriptionError(
                'SUBSCRIPTION_NOT_FOUND',
                'Subscrição não encontrada.',
            );
        }

        if (subscription.ended_at !== null) {
            throw new SubscriptionError(
                'SUBSCRIPTION_ALREADY_ENDED',
                'Esta subscrição já tinha terminado.',
            );
        }

        return this.subscriptionRepository.endNow(subscriptionId, revokedBy);
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
