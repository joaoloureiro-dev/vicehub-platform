import type { DatabaseClient, PermissionKey } from '@vicehub/database';
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';

import type { AuthContext } from './auth.types.js';
import type {
    SubscriptionEntitlement,
    SubscriptionOwnerKind,
} from '../../subscriptions/types/subscription.types.js';
import type { EffectivePermissions } from '../../authorization/types/authorization.types.js';

declare module 'fastify' {
    interface FastifyInstance {
        prisma: DatabaseClient;

        authenticate(
            request: FastifyRequest,
            reply: FastifyReply,
        ): Promise<void>;

        /**
         * Constrói um preHandler que exige as permissões indicadas.
         *
         * Deve vir sempre a seguir ao authenticate, de que depende.
         */
        authorize(...permissions: PermissionKey[]): preHandlerHookHandler;

        /**
         * Constrói um preHandler que exige subscrição ativa.
         *
         * O titular é indicado explicitamente: 'user' por omissão, ou
         * 'crew'/'server' para exigir o plano da entidade da rota.
         */
        requirePremium(owner?: SubscriptionOwnerKind): preHandlerHookHandler;
    }

    interface FastifyRequest {
        /**
         * Preenchido pelo middleware de autenticação.
         *
         * É null em rotas públicas, por isso os handlers protegidos
         * devem obtê-lo através de requireAuthContext().
         *
         * O payload cru do JWT continua disponível em request.user,
         * tipado pela augmentation em plugins/auth/jwt.types.ts.
         */
        authContext: AuthContext | null;

        /**
         * Permissões já reunidas neste pedido.
         *
         * Serve de cache: várias verificações no mesmo pedido não
         * repetem a consulta à base de dados.
         */
        effectivePermissions: EffectivePermissions | null;

        /**
         * Direito de acesso apurado neste pedido pelo requirePremium.
         */
        entitlement: SubscriptionEntitlement | null;
    }
}
