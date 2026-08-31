import fp from 'fastify-plugin';
import type {
    FastifyPluginAsync,
    FastifyReply,
    FastifyRequest,
} from 'fastify';

import { AuthError } from '../../modules/auth/errors/auth.errors.js';
import { AuthRepository } from '../../modules/auth/repositories/auth.repository.js';
import { AuthContextService } from '../../modules/auth/services/auth-context.service.js';

/**
 * Plugin responsável por proteger rotas através de JWT.
 *
 * Sempre que uma rota usar:
 *
 * preHandler: [fastify.authenticate]
 *
 * o payload do token fica em request.user e o contexto já validado
 * contra a base de dados fica em request.authContext.
 *
 * A verificação não se limita à assinatura do JWT: a sessão, o
 * utilizador e a tokenVersion são confirmados no AuthContextService.
 */
const authenticatePlugin: FastifyPluginAsync = async (fastify) => {
    const authContextService = new AuthContextService(
        new AuthRepository(fastify.prisma),
    );

    fastify.decorateRequest('authContext', null);

    fastify.decorate(
        'authenticate',
        async (
            request: FastifyRequest,
            _reply: FastifyReply,
        ): Promise<void> => {
            try {
                await request.jwtVerify();
            } catch {
                /**
                 * Normalizamos os erros do @fastify/jwt para o erro de
                 * domínio, para que a resposta seja consistente com o
                 * resto do módulo de autenticação.
                 */
                throw new AuthError(
                    'INVALID_ACCESS_TOKEN',
                    'Access token em falta ou inválido.',
                );
            }

            request.authContext = await authContextService.resolve(request.user);
        },
    );
};

export default fp(authenticatePlugin, {
    name: 'authenticate-plugin',
    dependencies: ['prisma-plugin', 'jwt-plugin'],
});
