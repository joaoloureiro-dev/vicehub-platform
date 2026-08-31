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
});
