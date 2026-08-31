import fp from 'fastify-plugin';
import type {
    FastifyPluginAsync,
    FastifyReply,
    FastifyRequest,
    preHandlerHookHandler,
} from 'fastify';

import { requireAuthContext } from '../../modules/auth/http/auth-context.guard.js';
import { AuthorizationRepository } from '../../modules/authorization/repositories/authorization.repository.js';
import { AuthorizationService } from '../../modules/authorization/services/authorization.service.js';
import type { PermissionKey } from '@vicehub/database';
import type {
    AuthorizationScope,
    EffectivePermissions,
} from '../../modules/authorization/types/authorization.types.js';

/**
 * Parâmetros de rota que definem o âmbito da autorização.
 *
 * Uma rota como /crews/:crewId/members é avaliada no âmbito dessa crew,
 * pelo que um cargo atribuído noutra crew não serve.
 */
interface ScopedRouteParams {
    crewId?: string;
    serverId?: string;
}

const readScopeFromRequest = (request: FastifyRequest): AuthorizationScope => {
    const params = (request.params ?? {}) as ScopedRouteParams;

    return {
        crewId: typeof params.crewId === 'string' ? params.crewId : undefined,
        serverId: typeof params.serverId === 'string' ? params.serverId : undefined,
    };
};

const isSameScope = (a: AuthorizationScope, b: AuthorizationScope): boolean =>
    a.crewId === b.crewId && a.serverId === b.serverId;

/**
 * Plugin que protege rotas por permissão.
 *
 * Usa-se a seguir ao middleware de autenticação:
 *
 * preHandler: [fastify.authenticate, fastify.authorize('crew:manage')]
 *
 * O âmbito é lido dos parâmetros crewId e serverId da própria rota, por
 * convenção, para que uma rota de crew não possa ser autorizada por um
 * cargo atribuído noutra crew por esquecimento de quem a escreveu.
 */
const authorizePlugin: FastifyPluginAsync = async (fastify) => {
    const authorizationService = new AuthorizationService(
        new AuthorizationRepository(fastify.prisma),
    );

    fastify.decorateRequest('effectivePermissions', null);

    /**
     * As permissões são lidas uma única vez por pedido. Uma rota que
     * declare várias permissões, ou que volte a consultá-las no handler,
     * não paga uma consulta por cada verificação.
     */
    const resolvePermissions = async (
        request: FastifyRequest,
        userId: string,
        scope: AuthorizationScope,
    ): Promise<EffectivePermissions> => {
        const cached = request.effectivePermissions;

        if (cached && cached.userId === userId && isSameScope(cached.scope, scope)) {
            return cached;
        }

        const effective = await authorizationService.getEffectivePermissions(
            userId,
            scope,
        );

        request.effectivePermissions = effective;

        return effective;
    };

    fastify.decorate(
        'authorize',
        (...required: PermissionKey[]): preHandlerHookHandler => {
            return async (
                request: FastifyRequest,
                _reply: FastifyReply,
            ): Promise<void> => {
                /**
                 * Sem contexto autenticado não há nada a autorizar. O guard
                 * lança em vez de assumir um utilizador anónimo, para que
                 * esquecer o authenticate seja um erro visível e não uma
                 * rota aberta.
                 */
                const { user } = requireAuthContext(request);

                const effective = await resolvePermissions(
                    request,
                    user.id,
                    readScopeFromRequest(request),
                );

                authorizationService.assertPermissions(effective, required);
            };
        },
    );
};

export default fp(authorizePlugin, {
    name: 'authorize-plugin',
    dependencies: ['prisma-plugin', 'authenticate-plugin'],
});
