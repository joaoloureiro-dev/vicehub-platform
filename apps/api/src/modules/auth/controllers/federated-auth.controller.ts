import type { FastifyReply, FastifyRequest } from 'fastify';

import { env } from '../../../config/env.js';
import { AuthError } from '../errors/auth.errors.js';
import { setRefreshTokenCookie } from '../http/auth-cookie.js';
import type { AuthService } from '../services/auth.service.js';
import type { FederatedAuthService } from '../services/federated-auth.service.js';

/**
 * Quanto dura o cookie do `state`.
 *
 * Minutos e não dias: é o tempo de autorizar, não o de uma sessão.
 */
const STATE_TTL_SEGUNDOS = 600;

/**
 * Entrar por outro sítio, do lado do HTTP.
 *
 * O regresso do fornecedor acaba num **encaminhamento** para a
 * aplicação, e não numa resposta com tokens. A razão é simples: o que
 * vem no endereço fica no histórico do browser, no referer e nos logs
 * de qualquer coisa pelo meio. Aqui o que fica é o cookie do refresh
 * token, que é HttpOnly — a aplicação arranca, pede `/auth/refresh`
 * como já fazia, e está dentro. Nenhum token passa pela barra de
 * endereços.
 */
export class FederatedAuthController {
    /**
     * O cookie que guarda o `state` entre a ida e o regresso.
     *
     * Um por fornecedor: com um cookie partilhado, começar a entrada
     * pela Google numa aba e pelo Discord noutra fazia a segunda ida
     * apagar o `state` da primeira, e quem voltasse pela primeira era
     * recusado sem perceber porquê.
     */
    private readonly stateCookie: string;

    constructor(
        private readonly federatedAuthService: FederatedAuthService,
        private readonly authService: AuthService,
        /** O nome do fornecedor no endereço: `discord`, `google`. */
        private readonly slug: string,
        /** Se esta forma de entrar está configurada nesta instalação. */
        private readonly configurado: boolean,
        /** Como o fornecedor se chama nas mensagens de erro. */
        private readonly fornecedor: string,
    ) {
        this.stateCookie = `vicehub_${slug}_state`;
    }

    /**
     * GET /auth/{slug} — manda para o fornecedor.
     */
    async start(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
        if (!this.configurado) {
            throw new AuthError(
                'FEDERATED_NOT_CONFIGURED',
                `Entrar com ${this.fornecedor} não está configurado nesta instalação.`,
            );
        }

        const state = this.federatedAuthService.generateState();

        reply.setCookie(this.stateCookie, state, {
            httpOnly: true,
            secure: env.AUTH_COOKIE_SECURE,
            /**
             * `lax` e não `strict`: quem volta do fornecedor vem de
             * outro sítio, e um cookie `strict` não seria enviado nessa
             * chegada — o `state` chegava sempre vazio e ninguém
             * entrava. O cookie não dá acesso a nada por si só.
             */
            sameSite: 'lax',
            path: '/api/v1/auth',
            maxAge: STATE_TTL_SEGUNDOS,
        });

        reply.redirect(this.federatedAuthService.buildAuthorizeUrl(state), 302);
    }

    /**
     * GET /auth/{slug}/callback — o regresso.
     */
    async callback(
        request: FastifyRequest<{
            Querystring: { code?: string; state?: string; error?: string };
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        this.limparState(reply);

        /**
         * Quem carrega em "cancelar" volta com `error` e sem código. Não
         * é uma avaria: é uma decisão, e o que se faz é levar a pessoa
         * de volta ao sítio de onde veio.
         */
        if (request.query.error !== undefined || request.query.code === undefined) {
            reply.redirect(this.paginaDeEntrada(), 302);
            return;
        }

        this.federatedAuthService.assertState(
            request.query.state,
            request.cookies[this.stateCookie],
        );

        const { userId } = await this.federatedAuthService.resolveAccount(
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
        reply.clearCookie(this.stateCookie, {
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
