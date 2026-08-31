import fp from 'fastify-plugin';
import type {
    FastifyPluginAsync,
    FastifyReply,
    FastifyRequest,
    preHandlerHookHandler,
} from 'fastify';

import { requireAuthContext } from '../../modules/auth/http/auth-context.guard.js';
import { SubscriptionError } from '../../modules/subscriptions/errors/subscription.errors.js';
import { SubscriptionRepository } from '../../modules/subscriptions/repositories/subscription.repository.js';
import { SubscriptionService } from '../../modules/subscriptions/services/subscription.service.js';
import type {
    SubscriptionOwner,
    SubscriptionOwnerKind,
} from '../../modules/subscriptions/types/subscription.types.js';

interface ScopedRouteParams {
    crewId?: string;
    serverId?: string;
}

/**
 * Plugin que protege rotas por subscrição.
 *
 * Usa-se a seguir ao middleware de autenticação:
 *
 * preHandler: [fastify.authenticate, fastify.requirePremium()]
 *
 * O titular é indicado explicitamente e não por convenção. Numa rota de
 * crew, exigir o plano da crew ou o plano de quem faz o pedido são
 * decisões diferentes, e adivinhar qual delas seria fonte de enganos.
 */
const requirePremiumPlugin: FastifyPluginAsync = async (fastify) => {
    const subscriptionService = new SubscriptionService(
        new SubscriptionRepository(fastify.prisma),
    );

    fastify.decorateRequest('entitlement', null);

    const readOwner = (
        request: FastifyRequest,
        kind: SubscriptionOwnerKind,
    ): SubscriptionOwner => {
        if (kind === 'user') {
            const { user } = requireAuthContext(request);

            return { userId: user.id };
        }

        const params = (request.params ?? {}) as ScopedRouteParams;
        const id = kind === 'crew' ? params.crewId : params.serverId;

        if (typeof id !== 'string' || id.length === 0) {
            throw new SubscriptionError(
                'INVALID_SUBSCRIPTION_OWNER',
                'Esta rota exige o plano de uma crew ou servidor, mas não indica qual.',
            );
        }

        return kind === 'crew' ? { crewId: id } : { serverId: id };
    };

    fastify.decorate(
        'requirePremium',
        (kind: SubscriptionOwnerKind = 'user'): preHandlerHookHandler => {
            return async (
                request: FastifyRequest,
                _reply: FastifyReply,
            ): Promise<void> => {
                /**
                 * Mesmo para o plano de uma crew, o pedido tem de estar
                 * autenticado: não existe acesso premium anónimo.
                 */
                requireAuthContext(request);

                const entitlement = await subscriptionService.getEntitlement(
                    readOwner(request, kind),
                );

                request.entitlement = entitlement;

                subscriptionService.assertPremium(entitlement);
            };
        },
    );
};

export default fp(requirePremiumPlugin, {
    name: 'require-premium-plugin',
    dependencies: ['prisma-plugin', 'authenticate-plugin'],
});
