import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fp from 'fastify-plugin';

import { env } from '../config/env.js';

/**
 * Regista as proteções HTTP globais da API.
 *
 * Este plugin centraliza:
 * - cabeçalhos HTTP de segurança;
 * - política de CORS;
 * - limitação global de pedidos.
 */
const securityPlugin = fp(
    async (app) => {
        await app.register(helmet, {
            global: true,

            /**
             * A API devolve JSON e não serve páginas HTML.
             * Mantemos uma política restritiva como proteção adicional.
             */
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'none'"],
                    frameAncestors: ["'none'"],
                },
            },

            /**
             * Impede que outros sites tentem incorporar recursos da API.
             */
            crossOriginResourcePolicy: {
                policy: 'same-site',
            },
        });

        await app.register(cors, {
            origin: (origin, callback) => {
                /**
                 * Pedidos sem Origin, como health checks, curl e comunicação
                 * entre serviços, não são automaticamente rejeitados.
                 */
                if (!origin) {
                    callback(null, true);
                    return;
                }

                const isAllowedOrigin = env.CORS_ALLOWED_ORIGINS.includes(origin);

                /**
                 * Uma origem não autorizada não deve gerar erro 500.
                 * Apenas não devolvemos headers CORS para essa origem.
                 */
                if (!isAllowedOrigin) {
                    callback(null, false);
                    return;
                }

                callback(null, true);
            },

            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
            exposedHeaders: ['X-Request-Id'],
            maxAge: 600,
        });

        await app.register(rateLimit, {
            global: true,
            max: 100,
            timeWindow: '1 minute',

            /**
             * O limite é associado ao IP do cliente.
             * Rotas de autenticação receberão limites mais restritos depois.
             */
            keyGenerator: (request) => request.ip,

            errorResponseBuilder: (_request, context) => ({
                statusCode: 429,
                error: 'Too Many Requests',
                message: 'Foram efetuados demasiados pedidos. Tenta novamente mais tarde.',
                retryAfterSeconds: Math.ceil(context.ttl / 1_000),
            }),
        });
    },
    {
        name: 'security-plugin',
    },
);

export default securityPlugin;