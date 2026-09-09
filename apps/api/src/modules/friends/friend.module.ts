import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { FriendController } from './controllers/friend.controller.js';
import { FriendRepository } from './repositories/friend.repository.js';
import { FriendService } from './services/friend.service.js';
import friendRoutes from './friend.routes.js';

/**
 * Módulo das amizades.
 */
const friendModule: FastifyPluginAsync = async (fastify) => {
    const friendService = new FriendService(new FriendRepository(fastify.prisma));

    await fastify.register(friendRoutes, {
        prefix: '/api/v1/friends',
        controller: new FriendController(friendService),
    });
};

export default fp(friendModule, {
    name: 'friend-module',
    dependencies: ['prisma-plugin', 'authenticate-plugin'],
});
