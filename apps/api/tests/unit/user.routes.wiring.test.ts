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
    const planoPorRota = new Map<string, string[]>();

    beforeAll(async () => {
        const app = Fastify();

        await app.register(validationPlugin);

        app.decorate('authenticate', vi.fn() as never);

        /**
         * O requirePremium devolve um preHandler; guardamos o titular
         * cujo plano cada rota exige, para poder verificar quais são as
         * rotas pagas e de quem é o plano que conta.
         */
        const planos = new Map<unknown, string>();

        app.decorate('requirePremium', ((kind = 'user') => {
            const handler = vi.fn();
            planos.set(handler, kind as string);
            return handler;
        }) as never);

        app.addHook('onRoute', (route) => {
            const key = `${route.method as string} ${route.url}`;
            registered.set(key, route);

            const preHandlers = route.preHandler
                ? Array.isArray(route.preHandler)
                    ? route.preHandler
                    : [route.preHandler]
                : [];

            planoPorRota.set(
                key,
                preHandlers.flatMap((handler) => {
                    const kind = planos.get(handler);

                    return kind === undefined ? [] : [kind];
                }),
            );
        });

        const controller = {
            getPublicProfile: vi.fn(),
            getOwnProfile: vi.fn(),
            updateOwnProfile: vi.fn(),
            updateOwnAppearance: vi.fn(),
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

    describe('personalização, que é funcionalidade do plano', () => {
        const rota = 'PATCH /me/appearance';

        it('exige autenticação e plano ativo', () => {
            expect(preHandlersOf(rota)).toHaveLength(2);
            expect(planoPorRota.get(rota)).toEqual(['user']);
        });

        /**
         * A personalização é uma rota à parte precisamente para que
         * alterar a bio continue a ser gratuito. Se um dia as duas se
         * juntassem, quem não paga deixava de poder mexer no perfil.
         */
        it('alterar bio e avatar continua a não exigir plano', () => {
            expect(planoPorRota.get('PATCH /me')).toEqual([]);
        });

        it('as rotas pagas são apenas esta', () => {
            const pagas = [...planoPorRota.entries()]
                .filter(([, kinds]) => kinds.length > 0)
                .map(([key]) => key);

            expect(pagas).toEqual([rota]);
        });

        /**
         * O segmento é estático e não colide com /:username, que só
         * aceita o padrão de um username.
         */
        it('não colide com o perfil público', () => {
            expect(registered.has(rota)).toBe(true);
            expect(registered.has('GET /:username')).toBe(true);
        });
    });

    it.each(['PATCH /me', 'PATCH /me/appearance'])(
        '%s valida o corpo',
        (key) => {
            expect(registered.get(key)?.schema?.body).toBeDefined();
        },
    );

    it('o perfil público valida o username recebido', () => {
        expect(registered.get('GET /:username')?.schema?.params).toBeDefined();
    });
});
