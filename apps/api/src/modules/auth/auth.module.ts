import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { createMailer } from '../mail/mailer.js';
import authRoutes from './auth.routes.js';
import { AuthController } from './controllers/auth.controller.js';
import { DiscordAuthController } from './controllers/discord-auth.controller.js';
import { DiscordClient } from './discord/discord.client.js';
import { AuthRepository } from './repositories/auth.repository.js';
import { AccountRecoveryService } from './services/account-recovery.service.js';
import { AccountTokenService } from './services/account-token.service.js';
import { AuthService } from './services/auth.service.js';
import { DiscordAuthService } from './services/discord-auth.service.js';
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

    const accountRecoveryService = new AccountRecoveryService(
        repository,
        passwordService,
        new AccountTokenService(),
        createMailer(fastify.log),
    );

    const controller = new AuthController(authService, accountRecoveryService);

    const discordController = new DiscordAuthController(
        new DiscordAuthService(repository, new DiscordClient()),
        authService,
    );

    await fastify.register(authRoutes, {
        prefix: '/api/v1/auth',
        controller,
        discordController,
    });
};

export default fp(authModule, {
    name: 'auth-module',
});