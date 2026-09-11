import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';

import type { AuthController } from './controllers/auth.controller.js';
import type { AuthProvidersController } from './controllers/auth-providers.controller.js';
import type { FederatedAuthController } from './controllers/federated-auth.controller.js';
import {
    loginSchema,
    registerSchema,
    requestPasswordResetSchema,
    resetPasswordSchema,
    verifyEmailSchema,
} from './schemas/auth.schemas.js';

interface AuthRoutesOptions {
    providersController: AuthProvidersController;
    discordController: FederatedAuthController;
    googleController: FederatedAuthController;
    controller: AuthController;
}

/**
 * Rotas do módulo de autenticação.
 *
 * Fazem o mapeamento entre endpoints HTTP e o AuthController,
 * declaram a validação de entrada e indicam quais as rotas
 * que exigem autenticação.
 */
const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
    fastify,
    options,
) => {
    const {
        controller,
        providersController,
        discordController,
        googleController,
    } = options;

    /**
     * Rotas públicas.
     *
     * O corpo é validado pelos schemas Zod antes de chegar ao controller.
     */
    fastify.post(
        '/register',
        { schema: { body: registerSchema } },
        controller.register.bind(controller),
    );

    fastify.post(
        '/login',
        { schema: { body: loginSchema } },
        controller.login.bind(controller),
    );

    /**
     * Entrar por outro sítio.
     *
     * Duas rotas por fornecedor e nenhum corpo: a ida manda para lá, e o
     * regresso traz um código no endereço. Ambas terminam num
     * encaminhamento, e é por isso que não devolvem JSON — quem as
     * percorre é o browser, e não a aplicação.
     *
     * As rotas existem sempre, mesmo onde o fornecedor não está
     * configurado; nesse caso a ida responde 503. É `/providers` que diz
     * ao ecrã de entrada que botões mostrar, e é por isso que ela é a
     * única das três que responde JSON.
     */
    fastify.get(
        '/providers',
        providersController.list.bind(providersController),
    );

    fastify.get(
        '/discord',
        discordController.start.bind(discordController),
    );

    fastify.get<{
        Querystring: { code?: string; state?: string; error?: string };
    }>(
        '/discord/callback',
        discordController.callback.bind(discordController),
    );

    fastify.get(
        '/google',
        googleController.start.bind(googleController),
    );

    fastify.get<{
        Querystring: { code?: string; state?: string; error?: string };
    }>(
        '/google/callback',
        googleController.callback.bind(googleController),
    );

    /**
     * Recuperar a password.
     *
     * Estas rotas levam um limite muito mais apertado do que o global.
     * Pedir recuperações em massa é a forma barata de usar a plataforma
     * para encher a caixa de correio de outra pessoa, e de arder a quota
     * do fornecedor de email a caminho disso. Adivinhar tokens às cegas
     * tem o mesmo remédio.
     *
     * O limite é por IP, como o global. Não chega para um atacante
     * distribuído, mas trava o caso comum — um guião a correr de um
     * sítio só.
     */
    const strictLimit = {
        rateLimit: {
            max: env.AUTH_RECOVERY_RATE_LIMIT_MAX,
            timeWindow: env.AUTH_RECOVERY_RATE_LIMIT_WINDOW,
        },
    };

    fastify.post(
        '/password-reset',
        { config: strictLimit, schema: { body: requestPasswordResetSchema } },
        controller.requestPasswordReset.bind(controller),
    );

    fastify.post(
        '/password-reset/confirm',
        { config: strictLimit, schema: { body: resetPasswordSchema } },
        controller.resetPassword.bind(controller),
    );

    /**
     * Confirmar o email.
     *
     * O pedido exige sessão — é para a própria conta. A confirmação não,
     * porque quem clica vem do email e pode estar noutro dispositivo.
     */
    fastify.post(
        '/email-verification',
        { config: strictLimit, preHandler: [fastify.authenticate] },
        controller.requestEmailVerification.bind(controller),
    );

    fastify.post(
        '/email-verification/confirm',
        { config: strictLimit, schema: { body: verifyEmailSchema } },
        controller.verifyEmail.bind(controller),
    );

    /**
     * O refresh token vem do cookie HttpOnly, por isso esta rota
     * não recebe corpo nem exige access token.
     */
    fastify.post('/refresh', controller.refresh.bind(controller));

    /**
     * Rotas protegidas.
     *
     * A identidade vem sempre do access token validado, nunca do
     * corpo do pedido.
     */
    fastify.post(
        '/logout',
        { preHandler: [fastify.authenticate] },
        controller.logout.bind(controller),
    );

    fastify.post(
        '/logout-all',
        { preHandler: [fastify.authenticate] },
        controller.logoutAll.bind(controller),
    );

    fastify.get(
        '/me',
        { preHandler: [fastify.authenticate] },
        controller.me.bind(controller),
    );
};

export default authRoutes;
