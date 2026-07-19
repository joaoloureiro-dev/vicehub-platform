import type { DatabaseClient } from '@vicehub/database';

declare module 'fastify' {
    interface FastifyInstance {
        prisma: DatabaseClient;
    }
}