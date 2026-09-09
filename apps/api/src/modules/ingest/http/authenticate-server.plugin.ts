import fp from 'fastify-plugin';
import type {
    FastifyPluginAsync,
    FastifyReply,
    FastifyRequest,
    preHandlerHookHandler,
} from 'fastify';

import { AuthError } from '../../auth/errors/auth.errors.js';
import { IngestRepository } from '../repositories/ingest.repository.js';
import { ApiKeyService } from '../services/api-key.service.js';
import { IngestService } from '../services/ingest.service.js';

/**
 * Autentica um **servidor** pela chave de API.
 *
 * Distinto do `authenticate` das pessoas, e tem de continuar a ser:
 * aquele põe um utilizador com cargos no pedido, e este põe apenas o
 * identificador de um servidor. Uma chave que caísse na porta errada e
 * passasse por sessão de utilizador daria a um script Lua o que só uma
 * pessoa devia ter.
 */
const authenticateServerPlugin: FastifyPluginAsync = async (fastify) => {
    const ingestService = new IngestService(
        new IngestRepository(fastify.prisma),
        new ApiKeyService(),
    );

    fastify.decorateRequest('serverContext', null);

    const guard: preHandlerHookHandler = async (
        request: FastifyRequest,
        _reply: FastifyReply,
    ): Promise<void> => {
        const cabecalho = request.headers.authorization;

        /**
         * A recusa é sempre a mesma, aconteça o que acontecer: sem
         * cabeçalho, mal escrito, chave inexistente, revogada, ou
         * segredo errado. Dizer *qual* dos casos é dizer a quem tenta o
         * que lhe falta acertar.
         */
        const apresentada =
            typeof cabecalho === 'string' && cabecalho.startsWith('Bearer ')
                ? cabecalho.slice('Bearer '.length).trim()
                : null;

        const contexto = apresentada
            ? await ingestService.resolveServer(apresentada)
            : null;

        if (!contexto) {
            throw new AuthError(
                'INVALID_ACCESS_TOKEN',
                'Chave de servidor inválida.',
            );
        }

        request.serverContext = contexto;
    };

    fastify.decorate('authenticateServer', guard);
};

declare module 'fastify' {
    interface FastifyInstance {
        authenticateServer: preHandlerHookHandler;
    }
}

export default fp(authenticateServerPlugin, {
    name: 'authenticate-server-plugin',
    dependencies: ['prisma-plugin'],
});
