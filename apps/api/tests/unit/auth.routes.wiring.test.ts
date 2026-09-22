import Fastify from 'fastify';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RouteOptions } from 'fastify';

import authRoutes from '../../src/modules/auth/auth.routes.js';
import type { AuthController } from '../../src/modules/auth/controllers/auth.controller.js';
import type { AuthProvidersController } from '../../src/modules/auth/controllers/auth-providers.controller.js';
import type { FederatedAuthController } from '../../src/modules/auth/controllers/federated-auth.controller.js';
import validationPlugin from '../../src/plugins/http/validation.plugin.js';

/**
 * Verifica quais as rotas que estão efetivamente ligadas ao middleware.
 *
 * O guard requireAuthContext já impede um handler protegido de correr
 * sem contexto, por isso remover o preHandler não muda o estado HTTP
 * devolvido. Sem este teste, essa ligação podia desaparecer sem que
 * nada falhasse, e as rotas passariam a depender apenas do guard.
 */
describe('ligação das rotas de autenticação ao middleware', () => {
    const registered = new Map<string, RouteOptions>();

    let oAuthenticate: unknown;

    beforeAll(async () => {
        const app = Fastify();

        /**
         * As rotas declaram schemas Zod, que só compilam com o
         * validator compiler da aplicação.
         */
        await app.register(validationPlugin);

        const authenticate = vi.fn();

        /*
         * Guardado para se poder perguntar se **este** handler está numa
         * rota, e não só quantos handlers ela tem. Contar era o que
         * havia antes, e contar diz "pública" de uma rota que ganhou um
         * guard que nada tem a ver com sessão.
         */
        oAuthenticate = authenticate;

        app.decorate('authenticate', authenticate as never);

        app.addHook('onRoute', (route) => {
            registered.set(`${route.method as string} ${route.url}`, route);
        });

        const controller = {
            register: vi.fn(),
            login: vi.fn(),
            refresh: vi.fn(),
            logout: vi.fn(),
            logoutAll: vi.fn(),
            me: vi.fn(),
            requestPasswordReset: vi.fn(),
            resetPassword: vi.fn(),
            requestEmailVerification: vi.fn(),
            verifyEmail: vi.fn(),
        } as unknown as AuthController;

        const federado = () =>
            ({
                start: vi.fn(),
                callback: vi.fn(),
            }) as unknown as FederatedAuthController;

        await app.register(authRoutes, {
            controller,
            providersController: {
                list: vi.fn(),
            } as unknown as AuthProvidersController,
            discordController: federado(),
            googleController: federado(),
        });
        await app.ready();
        await app.close();
    });

    const preHandlersOf = (key: string): unknown[] => {
        const route = registered.get(key);

        expect(route, `rota ${key} não registada`).toBeDefined();

        const preHandler = route?.preHandler;

        if (!preHandler) {
            return [];
        }

        return Array.isArray(preHandler) ? preHandler : [preHandler];
    };

    it.each([
        'POST /logout',
        'POST /logout-all',
        'GET /me',
    ])('%s exige autenticação', (key) => {
        expect(preHandlersOf(key)).toHaveLength(1);
    });

    /**
     * Pública quer dizer **não exige sessão**, e não "não tem
     * preHandlers".
     *
     * Eram a mesma coisa até o registo e o login ganharem o guard do
     * CAPTCHA, que não tem nada a ver com sessão. Contar handlers dizia
     * que tinham deixado de ser públicas — e a leitura certa é procurar
     * o `authenticate` e não o encontrar.
     */
    it.each([
        'POST /register',
        'POST /login',
        'POST /refresh',
    ])('%s permanece pública', (key) => {
        expect(preHandlersOf(key)).not.toContain(oAuthenticate);
    });

    /**
     * E as três portas que qualquer pessoa pode empurrar levam o
     * CAPTCHA.
     *
     * Antes do handler, de propósito: conferido depois, um guião já
     * gastou a contagem de tentativas falhadas de outra pessoa, e
     * bloquear a conta de alguém sem lhe saber a password é uma das
     * coisas que isto existe para impedir.
     *
     * A recuperação está cá pela outra razão: é a única rota que faz a
     * plataforma **escrever a alguém** sem que quem pede prove seja o
     * que for, e o que ela gasta é a caixa de correio de quem levar com
     * os emails e a quota de quem os entrega.
     */
    it.each(['POST /register', 'POST /login', 'POST /password-reset'])(
        '%s passa pelo CAPTCHA antes do handler',
        (key) => {
            expect(preHandlersOf(key)).toHaveLength(1);
            expect(preHandlersOf(key)).not.toContain(oAuthenticate);
        },
    );

    /**
     * O `refresh` não leva CAPTCHA. Não é uma porta: é uma sessão que já
     * existe a renovar-se, e pôr um desafio no caminho dela daria um
     * widget a quem está a navegar.
     */
    it('POST /refresh não leva CAPTCHA', () => {
        expect(preHandlersOf('POST /refresh')).toHaveLength(0);
    });

    /**
     * Entrar por outro sítio é para quem ainda não está dentro.
     *
     * Exigir sessão em qualquer destas seria exigir que se entrasse
     * antes de entrar: a ida seria recusada com 401 e ninguém chegava a
     * ver o ecrã de autorização. O `state` é que faz o papel de guarda
     * aqui, e é ele que o regresso verifica.
     */
    it.each([
        'GET /providers',
        'GET /discord',
        'GET /discord/callback',
        'GET /google',
        'GET /google/callback',
    ])('%s permanece sem sessão, por ser a forma de a obter', (key) => {
        expect(preHandlersOf(key)).toHaveLength(0);
    });

    it.each([
        'POST /register',
        'POST /login',
    ])('%s valida o corpo do pedido', (key) => {
        expect(registered.get(key)?.schema?.body).toBeDefined();
    });

    it('refresh não declara corpo, porque lê o cookie', () => {
        expect(registered.get('POST /refresh')?.schema?.body).toBeUndefined();
    });

    /**
     * As rotas de recuperação levam um limite próprio, muito mais
     * apertado do que o global de 100 pedidos por minuto.
     *
     * Pedir recuperações em massa é a forma barata de usar a plataforma
     * para encher a caixa de correio de outra pessoa, e de arder a quota
     * do fornecedor de email a caminho disso. Adivinhar tokens às cegas
     * tem o mesmo remédio.
     *
     * Nos testes de integração o limite é levantado por configuração,
     * para que a suite meça o fluxo e não o limitador — razão a mais
     * para que a sua existência fique fixada aqui.
     */
    describe('as rotas de recuperação têm limite próprio', () => {
        const rotas = [
            'POST /password-reset',
            'POST /password-reset/confirm',
            'POST /email-verification',
            'POST /email-verification/confirm',
        ];

        it.each(rotas)('%s declara um limite de pedidos', (key) => {
            const config = registered.get(key)?.config as
                | { rateLimit?: { max?: number; timeWindow?: string } }
                | undefined;

            expect(config?.rateLimit).toBeDefined();
            expect(config?.rateLimit?.max).toBeGreaterThan(0);
            expect(config?.rateLimit?.timeWindow).toBeTruthy();
        });

        /**
         * O global permite 100 por minuto. Um limite de recuperação que
         * fosse igual ou mais folgado não estaria a limitar nada.
         */
        it.each(rotas)('%s é mais apertado do que o global', (key) => {
            const config = registered.get(key)?.config as
                | { rateLimit?: { max?: number } }
                | undefined;

            expect(config?.rateLimit?.max).toBeLessThan(100);
        });

        /**
         * E a confirmação não leva CAPTCHA nem sessão.
         *
         * Quem lá chega traz um token que só podia ter vindo do email,
         * e pôr um desafio entre a pessoa e a password nova é atrito no
         * pior momento — logo a seguir a ela ter clicado no link para o
         * fazer.
         */
        it('confirmar a recuperação não exige sessão nem CAPTCHA', () => {
            expect(preHandlersOf('POST /password-reset/confirm')).toHaveLength(0);
        });

        /**
         * Quem clica no link de confirmação vem do email, e pode estar
         * noutro dispositivo. Exigir sessão faria falhar o caso comum.
         */
        it('confirmar o email não exige sessão', () => {
            expect(
                preHandlersOf('POST /email-verification/confirm'),
            ).toHaveLength(0);
        });

        it('pedir a confirmação exige sessão, por ser da própria conta', () => {
            expect(preHandlersOf('POST /email-verification')).toHaveLength(1);
        });
    });
});
