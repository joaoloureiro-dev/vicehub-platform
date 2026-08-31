import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { SubscriptionRepository } from '../subscriptions/repositories/subscription.repository.js';
import { SubscriptionService } from '../subscriptions/services/subscription.service.js';
import { UserController } from './controllers/user.controller.js';
import { UserRepository } from './repositories/user.repository.js';
import { UserService } from './services/user.service.js';
import userRoutes from './user.routes.js';

/**
 * Módulo responsável pelos perfis de utilizador.
 */
const userModule: FastifyPluginAsync = async (fastify) => {
    const userService = new UserService(
        new UserRepository(fastify.prisma),
        new SubscriptionService(new SubscriptionRepository(fastify.prisma)),
    );

    await fastify.register(userRoutes, {
        prefix: '/api/v1/users',
        controller: new UserController(userService),
    });
};

export default fp(userModule, {
    name: 'user-module',
    dependencies: ['prisma-plugin', 'authenticate-plugin'],
});
