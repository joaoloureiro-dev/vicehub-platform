import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fp from 'fastify-plugin';

import { env } from '../../config/env.js';

/**
 * A política de conteúdo, que depende de quem serve a interface.
 *
 * Enquanto a API só devolve JSON, o mais restritivo que existe é o que
 * serve: nada de scripts, nada de estilos, nada de nada. Quando é ela a
 * servir também o `apps/web` — que é o que `WEB_DIST_PATH` significa —
 * essa política aplicar-se-ia também à página, e uma página onde nada
 * pode carregar não abre. A alternativa fácil seria desligá-la; em vez
 * disso, alarga-se exatamente ao que a aplicação usa.
 *
 * Repara no que continua de fora: `'unsafe-inline'` nos scripts, que
 * transformaria um XSS numa execução, e `'unsafe-eval'`. O `style-src`
 * também não o leva — é por isso que nenhum componente escreve no
 * atributo `style`.
 */
const politicaDeConteudo = (): Record<string, string[]> => {
    if (env.WEB_DIST_PATH === undefined) {
        return {
            defaultSrc: ["'none'"],
            frameAncestors: ["'none'"],
        };
    }

    return {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],

        /**
         * O tipo de letra vem do Google Fonts: a folha de estilo dele, e
         * os ficheiros que ela pede, vêm de dois domínios diferentes.
         */
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],

        /** Os avatares e as capas ainda são `data:` gerados no cliente. */
        imgSrc: ["'self'", 'data:'],

        /** A API é a própria origem — é esse o objetivo de tudo isto. */
        connectSrc: ["'self'"],

        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],

        /**
         * Sem isto, um `<base>` injetado bastava para mandar todos os
         * caminhos relativos da página para outro servidor.
         */
        baseUri: ["'none'"],
        formAction: ["'self'"],
    };
};

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

            contentSecurityPolicy: {
                directives: politicaDeConteudo(),
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