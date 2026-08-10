import type { DatabaseClient } from '@vicehub/database';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AccessTokenPayload } from '../modules/auth/types/auth.types.js';

declare module 'fastify' {
    interface FastifyInstance {
        prisma: DatabaseClient;

        authenticate(
            request: FastifyRequest,
            reply: FastifyReply,
        ): Promise<void>;
    }

    interface FastifyRequest {
        user: AccessTokenPayload;
    }
}