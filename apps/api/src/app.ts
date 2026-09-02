import Fastify, {
    type FastifyBaseLogger,
    type FastifyHttpOptions,
    type FastifyInstance,
} from 'fastify';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

import { env } from './config/env.js';

import authModule from './modules/auth/auth.module.js';
import userModule from './modules/users/user.module.js';
import crewModule from './modules/crews/crew.module.js';
import serverModule from './modules/servers/server.module.js';
import subscriptionModule from './modules/subscriptions/subscription.module.js';
import billingModule from './modules/billing/billing.module.js';
import eventModule from './modules/events/event.module.js';
import treasuryModule from './modules/treasury/treasury.module.js';

import authenticatePlugin from './plugins/auth/authenticate.plugin.js';
import authorizePlugin from './plugins/auth/authorize.plugin.js';
import requirePremiumPlugin from './plugins/billing/require-premium.plugin.js';
import cookiePlugin from './plugins/auth/cookie.plugin.js';
import jwtPlugin from './plugins/auth/jwt.plugin.js';

import prismaPlugin from './plugins/database/prisma.plugin.js';

import securityPlugin from './plugins/http/security.plugin.js';
import errorHandlerPlugin from './plugins/http/error-handler.plugin.js';
import validationPlugin from './plugins/http/validation.plugin.js';
import bigIntSerializationPlugin from './plugins/http/bigint-serialization.plugin.js';

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

    // Tratamento de erros e validação Zod, antes de qualquer rota
    void app.register(errorHandlerPlugin);

    void app.register(validationPlugin);

    void app.register(bigIntSerializationPlugin);

    /**
     * Prisma é registado antes dos plugins de autenticação porque o
     * middleware de autenticação precisa de app.prisma para validar
     * a sessão na base de dados.
     */
    void app.register(prismaPlugin);

    // Cookies
    void app.register(cookiePlugin);

    // JWT
    void app.register(jwtPlugin);

    // Middleware de autenticação
    void app.register(authenticatePlugin);

    // Middleware de autorização por permissões
    void app.register(authorizePlugin);

    // Middleware de subscrição
    void app.register(requirePremiumPlugin);

    // Health Check
    void app.register(healthRoutes, {
        prefix: '/api/v1/health',
    });

    // Módulo de autenticação
    void app.register(authModule);

    // Módulo de utilizadores
    void app.register(userModule);

    // Módulo de crews
    void app.register(crewModule);

    // Módulo de servidores
    void app.register(serverModule);

    // Módulo de subscrições
    void app.register(subscriptionModule);

    // Módulo de tesouraria
    void app.register(treasuryModule);

    // Módulo de eventos
    void app.register(eventModule);

    // Módulo de cobrança
    void app.register(billingModule);

    return app;
};