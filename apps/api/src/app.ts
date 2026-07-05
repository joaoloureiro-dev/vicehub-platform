import Fastify, {
    type FastifyBaseLogger,
    type FastifyHttpOptions,
    type FastifyInstance,
} from 'fastify';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

import { env } from './config/env.js';
import cookiePlugin from './plugins/cookie.plugin.js';
import securityPlugin from './plugins/security.plugin.js';
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
    const app: ViceHubFastifyInstance = Fastify<Server>(createFastifyOptions());

    /**
     * A ordem dos plugins é intencional.
     *
     * Segurança e cookies são registados antes das rotas que dependem deles.
     */
    void app.register(securityPlugin);
    void app.register(cookiePlugin);

    void app.register(healthRoutes, {
        prefix: '/api/v1/health',
    });

    return app;
};