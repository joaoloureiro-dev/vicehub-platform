import type { FastifyPluginAsync } from 'fastify';

import type { AuthController } from './controllers/auth.controller.js';

interface AuthRoutesOptions {
    controller: AuthController;
}

/**
 * Rotas do módulo de autenticação.
 *
 * Apenas fazem o mapeamento entre
 * endpoints HTTP e o AuthController.
 */
const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
    fastify,
    options,
) => {
    const { controller } = options;

    fastify.post('/register', controller.register.bind(controller));

    fastify.post('/login', controller.login.bind(controller));

    fastify.post('/refresh', controller.refresh.bind(controller));

    fastify.post('/logout', controller.logout.bind(controller));

    fastify.post('/logout-all', controller.logoutAll.bind(controller));
};

export default authRoutes;