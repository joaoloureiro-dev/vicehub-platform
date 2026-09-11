import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { AuthProviderType } from '@vicehub/database';

import { isDiscordConfigured, isGoogleConfigured } from '../../config/env.js';
import { createMailer } from '../mail/mailer.js';
import authRoutes from './auth.routes.js';
import { AuthController } from './controllers/auth.controller.js';
import { AuthProvidersController } from './controllers/auth-providers.controller.js';
import { FederatedAuthController } from './controllers/federated-auth.controller.js';
import { DiscordClient } from './federated/discord.client.js';
import { GoogleClient } from './federated/google.client.js';
import { AuthRepository } from './repositories/auth.repository.js';
import { AccountRecoveryService } from './services/account-recovery.service.js';
import { AccountTokenService } from './services/account-token.service.js';
import { AuthService } from './services/auth.service.js';
import { FederatedAuthService } from './services/federated-auth.service.js';
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

    const discordController = new FederatedAuthController(
        new FederatedAuthService(
            repository,
            new DiscordClient(),
            AuthProviderType.discord,
            'O Discord',
        ),
        authService,
        'discord',
        isDiscordConfigured,
        'Discord',
    );

    const googleController = new FederatedAuthController(
        new FederatedAuthService(
            repository,
            new GoogleClient(),
            AuthProviderType.google,
            'A Google',
        ),
        authService,
        'google',
        isGoogleConfigured,
        'Google',
    );

    await fastify.register(authRoutes, {
        prefix: '/api/v1/auth',
        controller,
        providersController: new AuthProvidersController(),
        discordController,
        googleController,
    });
};

export default fp(authModule, {
    name: 'auth-module',
});