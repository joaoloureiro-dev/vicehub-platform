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
export const politicaDeConteudo = (): Record<string, string[]> => {
    if (env.WEB_DIST_PATH === undefined) {
        return {
            defaultSrc: ["'none'"],
            frameAncestors: ["'none'"],
        };
    }

    /**
     * O CAPTCHA é um script de terceiros, e só entra na política quando
     * está configurado.
     *
     * Sem as chaves do Turnstile não há widget nenhum, e a política
     * continua a recusar scripts de fora — que é o que mantém
     * verdadeira a promessa da página de privacidade em qualquer
     * instalação que não o ligue. Com elas, tem de entrar em dois
     * sítios: o `script-src` carrega o `api.js`, e o `frame-src` deixa
     * abrir a moldura onde o desafio acontece.
     *
     * Estava a faltar, e o efeito só aparecia em produção com o CAPTCHA
     * ligado: o browser bloqueava o script, o widget nunca desenhava, e
     * ninguém conseguia entrar nem registar-se. Nenhum teste podia dar
     * por isso enquanto a política não distinguisse os dois casos.
     */
    const CAPTCHA = 'https://challenges.cloudflare.com';

    const comCaptcha = env.TURNSTILE_SITE_KEY !== undefined;

    return {
        defaultSrc: ["'self'"],
        scriptSrc: comCaptcha ? ["'self'", CAPTCHA] : ["'self'"],
        ...(comCaptcha ? { frameSrc: [CAPTCHA] } : {}),

        /**
         * O tipo de letra vem do Google Fonts: a folha de estilo dele, e
         * os ficheiros que ela pede, vêm de dois domínios diferentes.
         */
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],

        /**
         * As imagens vêm de qualquer sítio, e é assim que o produto
         * está desenhado: **o ViceHub não aloja imagens — guarda o
         * endereço que lhe deram**, e é isso que a política de
         * privacidade diz a quem a lê. Um avatar, uma capa de crew, a
         * fotografia de um anúncio: todos são endereços escritos por
         * pessoas, e não há lista que os cubra.
         *
         * Estava em `'self' data:`, o que bloqueava todas essas imagens
         * num deploy a sério. Só se via em produção: em desenvolvimento
         * a política é a mesma, mas ninguém tinha posto um endereço de
         * fora para reparar.
         *
         * `https:` e não `*`: um endereço em `http:` numa página
         * cifrada é conteúdo misto, que o browser bloqueia de qualquer
         * maneira e que faria o cadeado desaparecer.
         */
        imgSrc: ["'self'", 'data:', 'https:'],

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
            max: env.RATE_LIMIT_MAX,
            timeWindow: env.RATE_LIMIT_WINDOW,

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