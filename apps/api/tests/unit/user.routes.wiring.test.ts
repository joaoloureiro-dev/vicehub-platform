import Fastify from 'fastify';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RouteOptions } from 'fastify';

import userRoutes from '../../src/modules/users/user.routes.js';
import validationPlugin from '../../src/plugins/http/validation.plugin.js';
import type { UserController } from '../../src/modules/users/controllers/user.controller.js';

/**
 * Verifica quais as rotas de utilizador que exigem autenticação.
 *
 * O perfil público é deliberadamente aberto. Se um dia deixar de o ser,
 * ou se uma rota do próprio deixar de exigir token, é aqui que se vê.
 */
describe('ligação das rotas de utilizador', () => {
    const registered = new Map<string, RouteOptions>();

    beforeAll(async () => {
        const app = Fastify();

        await app.register(validationPlugin);

        app.decorate('authenticate', vi.fn() as never);

        app.addHook('onRoute', (route) => {
            registered.set(`${route.method as string} ${route.url}`, route);
        });

        const controller = {
            getPublicProfile: vi.fn(),
            getOwnProfile: vi.fn(),
            updateOwnProfile: vi.fn(),
        } as unknown as UserController;

        await app.register(userRoutes, { controller });
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

    it.each(['GET /me', 'PATCH /me'])('%s exige autenticação', (key) => {
        expect(preHandlersOf(key)).toHaveLength(1);
    });

    it('o perfil público não exige autenticação', () => {
        /**
         * É esta ausência que faz o perfil ser público. Está fixada por
         * um teste para não desaparecer por descuido.
         */
        expect(preHandlersOf('GET /:username')).toHaveLength(0);
    });

    it('a alteração de perfil valida o corpo', () => {
        expect(registered.get('PATCH /me')?.schema?.body).toBeDefined();
    });

    it('o perfil público valida o username recebido', () => {
        expect(registered.get('GET /:username')?.schema?.params).toBeDefined();
    });
});
