import Fastify from 'fastify';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RouteOptions } from 'fastify';

import authRoutes from '../../src/modules/auth/auth.routes.js';
import type { AuthController } from '../../src/modules/auth/controllers/auth.controller.js';
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

    beforeAll(async () => {
        const app = Fastify();

        /**
         * As rotas declaram schemas Zod, que só compilam com o
         * validator compiler da aplicação.
         */
        await app.register(validationPlugin);

        const authenticate = vi.fn();

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

        await app.register(authRoutes, { controller });
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

    it.each([
        'POST /register',
        'POST /login',
        'POST /refresh',
    ])('%s permanece pública', (key) => {
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

        it('confirmar a recuperação não exige sessão', () => {
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
