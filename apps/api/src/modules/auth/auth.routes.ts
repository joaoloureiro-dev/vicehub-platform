import type { FastifyPluginAsync } from 'fastify';

import type { AuthController } from './controllers/auth.controller.js';
import { loginSchema, registerSchema } from './schemas/auth.schemas.js';

interface AuthRoutesOptions {
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
    const { controller } = options;

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
