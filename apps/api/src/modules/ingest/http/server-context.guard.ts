import type { FastifyRequest } from 'fastify';

/**
 * O servidor a que o pedido pertence, quando quem fala é uma chave.
 *
 * É **outra coisa** que o contexto de utilizador, e de propósito: uma
 * chave não é uma pessoa, não tem cargos e não tem permissões. O que
 * traz é o identificador de um servidor, e mais nada — o que uma chave
 * roubada consegue fazer é mentir sobre esse servidor, e não mexer em
 * contas, tesourarias ou planos.
 */
export interface ServerContext {
    serverId: string;
    apiKeyId: string;
}

declare module 'fastify' {
    interface FastifyRequest {
        serverContext: ServerContext | null;
    }
}

/**
 * Lê o contexto do servidor, ou rebenta.
 *
 * Rebentar em vez de assumir um servidor anónimo faz com que esquecer o
 * guard na rota seja um erro visível, e não uma rota aberta.
 */
export const requireServerContext = (request: FastifyRequest): ServerContext => {
    if (!request.serverContext) {
        throw new Error(
            '[ViceHub Ingest] Rota sem authenticateServer: não há servidor no pedido.',
        );
    }

    return request.serverContext;
};
