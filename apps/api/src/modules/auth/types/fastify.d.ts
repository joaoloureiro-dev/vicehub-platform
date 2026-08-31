import type { DatabaseClient } from '@vicehub/database';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AuthContext } from './auth.types.js';

declare module 'fastify' {
    interface FastifyInstance {
        prisma: DatabaseClient;

        authenticate(
            request: FastifyRequest,
            reply: FastifyReply,
        ): Promise<void>;
    }

    interface FastifyRequest {
        /**
         * Preenchido pelo middleware de autenticação.
         *
         * É null em rotas públicas, por isso os handlers protegidos
         * devem obtê-lo através de requireAuthContext().
         *
         * O payload cru do JWT continua disponível em request.user,
         * tipado pela augmentation em plugins/auth/jwt.types.ts.
         */
        authContext: AuthContext | null;
    }
}
