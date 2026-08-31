import { SubscriptionError } from '../errors/subscription.errors.js';
import type { SubscriptionRepository } from '../repositories/subscription.repository.js';
import type {
    SubscriptionEntitlement,
    SubscriptionOwner,
} from '../types/subscription.types.js';

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
