import type { FastifyRequest } from 'fastify';

import { AuthError } from '../errors/auth.errors.js';
import type { AuthContext } from '../types/auth.types.js';

/**
 * Devolve o contexto autenticado do pedido.
 *
 * request.authContext é null em rotas públicas, por isso este guard
 * converte a ausência de contexto num erro de domínio em vez de
 * obrigar os handlers a usar asserções não nulas.
 */
export const requireAuthContext = (request: FastifyRequest): AuthContext => {
    if (!request.authContext) {
        throw new AuthError(
            'INVALID_ACCESS_TOKEN',
            'Este pedido requer autenticação.',
        );
    }

    return request.authContext;
};
