import cookie from '@fastify/cookie';
import fp from 'fastify-plugin';

/**
 * Regista o suporte para cookies HTTP.
 *
 * O refresh token será armazenado posteriormente num cookie:
 * - HttpOnly;
 * - Secure em produção;
 * - SameSite configurado;
 * - limitado à rota de autenticação.
 */
const cookiePlugin = fp(
    async (app) => {
        await app.register(cookie);
    },
    {
        name: 'cookie-plugin',
    },
);

export default cookiePlugin;