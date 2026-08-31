import type { FastifyReply } from 'fastify';

import { env } from '../../../config/env.js';

/**
 * Caminho a que o cookie do refresh token está limitado.
 *
 * Restringir o caminho evita que o cookie seja enviado em todos os
 * pedidos à API: só as rotas de autenticação precisam dele.
 */
export const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth';

/**
 * Opções do cookie que transporta o refresh token.
 *
 * httpOnly impede o acesso por JavaScript no browser, o que é a
 * proteção principal contra roubo do token por XSS.
 *
 * sameSite strict é adequado enquanto a aplicação e a API partilharem
 * o mesmo site registável. Se a API passar a viver noutro domínio,
 * isto terá de passar a 'none' com secure ativo.
 */
const buildCookieOptions = () => ({
    httpOnly: true,
    secure: env.AUTH_COOKIE_SECURE,
    sameSite: 'strict' as const,
    path: REFRESH_TOKEN_COOKIE_PATH,
});

/**
 * Coloca o refresh token num cookie HttpOnly.
 *
 * O refresh token nunca é devolvido no corpo da resposta:
 * se fosse, o httpOnly deixaria de ter qualquer valor.
 */
export const setRefreshTokenCookie = (
    reply: FastifyReply,
    refreshToken: string,
): void => {
    reply.setCookie(env.AUTH_COOKIE_NAME, refreshToken, {
        ...buildCookieOptions(),
        maxAge: env.JWT_REFRESH_TOKEN_TTL_SECONDS,
    });
};

/**
 * Remove o cookie do refresh token.
 *
 * As opções têm de coincidir com as usadas na escrita,
 * caso contrário o browser não remove o cookie.
 */
export const clearRefreshTokenCookie = (reply: FastifyReply): void => {
    reply.clearCookie(env.AUTH_COOKIE_NAME, buildCookieOptions());
};
