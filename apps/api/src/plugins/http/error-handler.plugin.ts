import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';

import {
    AuthError,
    type AuthErrorCode,
} from '../../modules/auth/errors/auth.errors.js';

/**
 * Estado HTTP associado a cada erro de domínio da autenticação.
 *
 * Manter o mapa exaustivo garante que um código novo em AuthErrorCode
 * obriga a decidir o estado HTTP correspondente em vez de cair
 * silenciosamente em 500.
 */
const authErrorStatusCodes: Record<AuthErrorCode, number> = {
    EMAIL_ALREADY_EXISTS: 409,
    INVALID_CREDENTIALS: 401,
    INVALID_ACCESS_TOKEN: 401,
    INVALID_REFRESH_TOKEN: 401,
    REFRESH_TOKEN_REUSED: 401,
    SESSION_NOT_FOUND: 404,
    USER_NOT_FOUND: 404,
};

const httpErrorNames: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    404: 'Not Found',
    409: 'Conflict',
};

/**
 * Extrai estado e código de um erro sem assumir a sua forma.
 *
 * O Fastify tipa o erro como unknown porque um handler pode lançar
 * qualquer valor. Só confiamos nos campos que existem mesmo.
 */
const classifyError = (
    error: unknown,
): { statusCode: number; code: string; message: string } => {
    if (typeof error !== 'object' || error === null) {
        return {
            statusCode: 500,
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erro interno do servidor.',
        };
    }

    const candidate = error as {
        statusCode?: unknown;
        code?: unknown;
        message?: unknown;
    };

    const statusCode =
        typeof candidate.statusCode === 'number' ? candidate.statusCode : 500;

    return {
        statusCode,
        code: typeof candidate.code === 'string' ? candidate.code : 'ERROR',
        /**
         * A mensagem original só é revelada em erros do cliente.
         * Em erros 5xx podia expor detalhes internos.
         */
        message:
            statusCode < 500 && typeof candidate.message === 'string'
                ? candidate.message
                : 'Erro interno do servidor.',
    };
};

/**
 * Plugin global de tratamento de erros HTTP.
 *
 * Garante que erros de domínio e erros de validação não são
 * expostos como erro interno 500.
 */
const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
    fastify.setErrorHandler((error, request, reply) => {
        if (error instanceof AuthError) {
            const statusCode = authErrorStatusCodes[error.code];

            /**
             * Erros de autenticação são esperados e não indicam avaria.
             * Registamos com nível de aviso para não poluir os alertas.
             */
            request.log.warn(
                { err: error, code: error.code },
                'Pedido rejeitado pelo módulo de autenticação.',
            );

            reply.status(statusCode).send({
                statusCode,
                code: error.code,
                error: httpErrorNames[statusCode] ?? 'Error',
                message: error.message,
            });
            return;
        }

        if (error instanceof ZodError) {
            request.log.warn(
                { issues: error.issues },
                'Pedido rejeitado por falha de validação.',
            );

            reply.status(400).send({
                statusCode: 400,
                code: 'VALIDATION_ERROR',
                error: 'Bad Request',
                message: 'Os dados enviados são inválidos.',
                issues: error.issues.map((issue) => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                })),
            });
            return;
        }

        /**
         * Erros já classificados pelo Fastify, como corpo JSON malformado
         * ou limite de pedidos excedido, mantêm o seu estado original.
         */
        const classified = classifyError(error);

        if (classified.statusCode < 500) {
            request.log.warn({ err: error }, 'Pedido rejeitado.');

            reply.status(classified.statusCode).send({
                statusCode: classified.statusCode,
                code: classified.code,
                error: httpErrorNames[classified.statusCode] ?? 'Error',
                message: classified.message,
            });
            return;
        }

        request.log.error(
            { err: error },
            'Erro capturado pelo error handler global.',
        );

        /**
         * Erros inesperados nunca expõem detalhes internos ao cliente.
         */
        reply.status(500).send({
            statusCode: 500,
            code: 'INTERNAL_SERVER_ERROR',
            error: 'Internal Server Error',
            message: 'Erro interno do servidor.',
        });
    });
};

export default fp(errorHandlerPlugin, {
    name: 'error-handler-plugin',
});
