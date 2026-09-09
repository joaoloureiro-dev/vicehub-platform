import type { FastifyReply, FastifyRequest } from 'fastify';

import { env, isDiscordConfigured } from '../../../config/env.js';
import { AuthError } from '../errors/auth.errors.js';
import { setRefreshTokenCookie } from '../http/auth-cookie.js';
import type { AuthService } from '../services/auth.service.js';
import type { DiscordAuthService } from '../services/discord-auth.service.js';

/**
 * O cookie que guarda o `state` entre a ida ao Discord e o regresso.
 *
 * Dura minutos e não dias: é o tempo de autorizar, não o de uma sessão.
 */
const STATE_COOKIE = 'vicehub_discord_state';
const STATE_TTL_SEGUNDOS = 600;

/**
 * Entrar com Discord, do lado do HTTP.
 *
 * O regresso do Discord acaba num **encaminhamento** para a aplicação,
 * e não numa resposta com tokens. A razão é simples: o que vem no
 * endereço fica no histórico do browser, no referer e nos logs de
 * qualquer coisa pelo meio. Aqui o que fica é o cookie do refresh
 * token, que é HttpOnly — a aplicação arranca, pede `/auth/refresh`
 * como já fazia, e está dentro. Nenhum token passa pela barra de
 * endereços.
 */
export class DiscordAuthController {
    constructor(
        private readonly discordAuthService: DiscordAuthService,
        private readonly authService: AuthService,
    ) { }

    /**
     * GET /auth/providers — que formas de entrar existem aqui.
     *
     * Pública e sem sessão: é lida pelo ecrã de entrada, antes de haver
     * conta nenhuma. Existe para que o botão do Discord só apareça onde
     * funciona — um botão que leva a um erro é pior do que botão nenhum.
     */
    async providers(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
        reply.send({ discord: isDiscordConfigured });
    }

    /**
     * GET /auth/discord — manda para o Discord.
     */
    async start(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
        if (!isDiscordConfigured) {
            throw new AuthError(
                'DISCORD_NOT_CONFIGURED',
                'Entrar com Discord não está configurado nesta instalação.',
            );
        }

        const state = this.discordAuthService.generateState();

        reply.setCookie(STATE_COOKIE, state, {
            httpOnly: true,
            secure: env.AUTH_COOKIE_SECURE,
            /**
             * `lax` e não `strict`: quem volta do Discord vem de outro
             * sítio, e um cookie `strict` não seria enviado nessa
             * chegada — o `state` chegava sempre vazio e ninguém
             * entrava. O cookie não dá acesso a nada por si só.
             */
            sameSite: 'lax',
            path: '/api/v1/auth',
            maxAge: STATE_TTL_SEGUNDOS,
        });

        reply.redirect(this.discordAuthService.buildAuthorizeUrl(state), 302);
    }

    /**
     * GET /auth/discord/callback — o regresso.
     */
    async callback(
        request: FastifyRequest<{
            Querystring: { code?: string; state?: string; error?: string };
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        this.limparState(reply);

        /**
         * Quem carrega em "cancelar" no Discord volta com `error` e sem
         * código. Não é uma avaria: é uma decisão, e o que se faz é
         * levar a pessoa de volta ao sítio de onde veio.
         */
        if (request.query.error !== undefined || request.query.code === undefined) {
            reply.redirect(this.paginaDeEntrada(), 302);
            return;
        }

        this.discordAuthService.assertState(
            request.query.state,
            request.cookies[STATE_COOKIE],
        );

        const { userId } = await this.discordAuthService.resolveAccount(
            request.query.code,
        );

        const resultado = await this.authService.startSessionFor(userId, {
            ...(request.ip ? { ipAddress: request.ip } : {}),
            ...(request.headers['user-agent']
                ? { userAgent: request.headers['user-agent'] }
                : {}),
        });

        setRefreshTokenCookie(reply, resultado.refreshToken);

        reply.redirect(this.paginaInicial(), 302);
    }

    /**
     * O `state` serve uma vez. Apagá-lo no regresso impede que um
     * segundo regresso com o mesmo código reutilize o emparelhamento.
     */
    private limparState(reply: FastifyReply): void {
        reply.clearCookie(STATE_COOKIE, {
            httpOnly: true,
            secure: env.AUTH_COOKIE_SECURE,
            sameSite: 'lax',
            path: '/api/v1/auth',
        });
    }

    private paginaInicial(): string {
        return new URL('/eu', env.APP_PUBLIC_URL).toString();
    }

    private paginaDeEntrada(): string {
        return new URL('/entrar', env.APP_PUBLIC_URL).toString();
    }
}
