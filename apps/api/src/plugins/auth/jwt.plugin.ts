import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';

import { env } from '../../config/env.js';

/**
 * Plugin responsável pela configuração JWT do ViceHub.
 *
 * Mantemos a configuração isolada para:
 * - evitar JWT espalhado pela aplicação;
 * - permitir testes;
 * - facilitar futuras alterações de estratégia.
 */
export default fp(async (fastify) => {
    await fastify.register(fastifyJwt, {
        secret: env.JWT_ACCESS_SECRET,

        sign: {
            expiresIn: `${env.JWT_ACCESS_TOKEN_TTL_SECONDS}s`,
        },
    });
});