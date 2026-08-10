import fp from 'fastify-plugin';
import type {
    FastifyPluginAsync,
    FastifyReply,
    FastifyRequest,
} from 'fastify';

/**
 * Plugin responsável por proteger rotas através de JWT.
 *
 * Sempre que uma rota usar:
 *
 * preHandler: [fastify.authenticate]
 *
 * o utilizador ficará disponível em request.user.
 */
const authenticatePlugin: FastifyPluginAsync = async (fastify) => {
    fastify.decorate(
        'authenticate',
        async (
            request: FastifyRequest,
            _reply: FastifyReply,
        ): Promise<void> => {
            await request.jwtVerify();
        },
    );
};

export default fp(authenticatePlugin, {
    name: 'authenticate-plugin',
});