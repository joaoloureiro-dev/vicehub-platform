import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';

/**
 * Plugin responsável pela configuração do JWT.
 *
 * Responsabilidades:
 * - registar @fastify/jwt;
 * - configurar assinatura dos Access Tokens;
 * - disponibilizar request.jwtVerify();
 * - disponibilizar reply.jwtSign();
 *
 * Não contém qualquer lógica de autenticação.
 * Toda a lógica permanece no AuthService.
 */
const jwtPlugin: FastifyPluginAsync = async (fastify) => {
    await fastify.register(fastifyJwt, {
        secret: env.JWT_ACCESS_SECRET,

        sign: {
            expiresIn: `${env.JWT_ACCESS_TOKEN_TTL_SECONDS}s`,
        },
    });
};

export default fp(jwtPlugin, {
    name: 'jwt-plugin',
});