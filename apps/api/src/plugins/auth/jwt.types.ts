import '@fastify/jwt';

import type { AccessTokenPayload } from '../../modules/auth/types/auth.types.js';

/**
 * Augmentation do módulo @fastify/jwt.
 *
 * Faz com que request.user fique automaticamente
 * tipado em toda a aplicação.
 */
declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: AccessTokenPayload;
        user: AccessTokenPayload;
    }
}