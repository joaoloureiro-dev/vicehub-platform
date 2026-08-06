import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import authRoutes from './auth.routes.js';
import { AuthController } from './controllers/auth.controller.js';
import { AuthRepository } from './repositories/auth.repository.js';
import { AuthService } from './services/auth.service.js';
import { PasswordService } from './services/password.service.js';
import { TokenService } from './services/token.service.js';

/**
 * Módulo responsável pela autenticação.
 */
const authModule: FastifyPluginAsync = async (fastify) => {
    const repository = new AuthRepository(fastify.prisma);

    const passwordService = new PasswordService();

    const tokenService = new TokenService(fastify);

    const authService = new AuthService(
        repository,
        passwordService,
        tokenService,
    );

    const controller = new AuthController(authService);

    await fastify.register(authRoutes, {
        prefix: '/api/v1/auth',
        controller,
    });
};

export default fp(authModule, {
    name: 'auth-module',
});