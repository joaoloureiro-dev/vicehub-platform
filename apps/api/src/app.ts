import Fastify, {
    type FastifyBaseLogger,
    type FastifyHttpOptions,
    type FastifyInstance,
} from 'fastify';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

import { env } from './config/env.js';

import authModule from './modules/auth/auth.module.js';

import authenticatePlugin from './plugins/auth/authenticate.plugin.js';
import cookiePlugin from './plugins/auth/cookie.plugin.js';
import jwtPlugin from './plugins/auth/jwt.plugin.js';

import prismaPlugin from './plugins/database/prisma.plugin.js';

import securityPlugin from './plugins/http/security.plugin.js';
import errorHandlerPlugin from './plugins/http/error-handler.plugin.js';

import healthRoutes from './routes/health/health.routes.js';

type ViceHubFastifyInstance = FastifyInstance<
    Server,
    IncomingMessage,
    ServerResponse,
    FastifyBaseLogger
>;

type ViceHubFastifyOptions = FastifyHttpOptions<Server, FastifyBaseLogger>;

/**
 * Cria a configuração da aplicação Fastify.
 *
 * Mantemos a função separada para evitar que propriedades opcionais
 * sejam passadas como undefined quando usamos exactOptionalPropertyTypes.
 */
const createFastifyOptions = (): ViceHubFastifyOptions => {
    const baseOptions = {
        bodyLimit: 1_048_576,

        /**
         * Garante um identificador único para cada pedido.
         */
        requestIdHeader: 'x-request-id',
        requestIdLogLabel: 'requestId',

        /**
         * Desativa confiança automática em proxies.
         * Será configurado explicitamente conforme o ambiente de deployment.
         */
        trustProxy: false,

        /**
         * Evita que pedidos excessivamente lentos mantenham ligações abertas.
         */
        requestTimeout: 15_000,
        connectionTimeout: 10_000,
        keepAliveTimeout: 72_000,
    } satisfies Omit<ViceHubFastifyOptions, 'logger'>;

    if (env.NODE_ENV === 'development') {
        return {
            ...baseOptions,
            logger: {
                level: env.API_LOG_LEVEL,
                transport: {
                    target: 'pino-pretty',
                    options: {
                        colorize: true,
                        translateTime: 'SYS:standard',
                        ignore: 'pid,hostname',
                    },
                },
            },
        };
    }

    return {
        ...baseOptions,
        logger: {
            level: env.API_LOG_LEVEL,
        },
    };
};

/**
 * Constrói a aplicação Fastify sem abrir uma porta HTTP.
 *
 * Esta separação permite:
 * - testes de integração com app.inject();
 * - execução em processos diferentes;
 * - reutilização por ferramentas de desenvolvimento;
 * - arranque e encerramento controlados.
 */
export const buildApp = (): ViceHubFastifyInstance => {
    const app: ViceHubFastifyInstance = Fastify<Server>(
        createFastifyOptions(),
    );

    /**
     * A ordem dos plugins é intencional.
     *
     * Primeiro registamos toda a infraestrutura,
     * depois os módulos da aplicação.
     */

    // Segurança HTTP
    void app.register(securityPlugin);

    void app.register(errorHandlerPlugin);

    // Cookies
    void app.register(cookiePlugin);

    // JWT
    void app.register(jwtPlugin);

    // Middleware de autenticação
    void app.register(authenticatePlugin);

    // Prisma
    void app.register(prismaPlugin);

    // Health Check
    void app.register(healthRoutes, {
        prefix: '/api/v1/health',
    });

    // Módulo de autenticação
    void app.register(authModule);

    return app;
};