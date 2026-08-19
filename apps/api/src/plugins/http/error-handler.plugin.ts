import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { AuthError } from '../../modules/auth/errors/auth.errors.js';

/**
 * Plugin global de tratamento de erros HTTP.
 *
 * Garante que erros de domínio não são expostos
 * como erro interno 500.
 */
const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
    fastify.setErrorHandler((error, request, reply) => {
        request.log.error(
            {
                err: error,
            },
            'Erro capturado pelo error handler global.',
        );

        if (error instanceof AuthError) {
            switch (error.code) {
                case 'EMAIL_ALREADY_EXISTS':
                    reply.status(409).send({
                        statusCode: 409,
                        code: error.code,
                        error: 'Conflict',
                        message: error.message,
                    });
                    return;

                case 'INVALID_CREDENTIALS':
                case 'INVALID_REFRESH_TOKEN':
                    reply.status(401).send({
                        statusCode: 401,
                        code: error.code,
                        error: 'Unauthorized',
                        message: error.message,
                    });
                    return;

                case 'SESSION_NOT_FOUND':
                case 'USER_NOT_FOUND':
                    reply.status(404).send({
                        statusCode: 404,
                        code: error.code,
                        error: 'Not Found',
                        message: error.message,
                    });
                    return;
            }
        }

        reply.status(500).send({
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'Erro interno do servidor.',
        });
    });
};

export default fp(errorHandlerPlugin, {
    name: 'error-handler-plugin',
});