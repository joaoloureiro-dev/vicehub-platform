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
            exportOwnAccount: vi.fn(),
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

    /**
     * Levar os dados consigo exige sessão e um limite próprio.
     *
     * A sessão porque são os dados de alguém; o limite porque é a
     * leitura mais pesada que uma conta pode pedir, e chamá-la em ciclo
     * punha a base de dados de joelhos com uma conta só.
     */
    describe('levar os dados consigo', () => {
        const rota = 'GET /me/export';

        it('exige sessão', () => {
            expect(preHandlersOf(rota)).toHaveLength(1);
        });

        it('leva um limite de pedidos mais apertado do que o global', () => {
            const config = registered.get(rota)?.config as
                | { rateLimit?: { max?: number; timeWindow?: string } }
                | undefined;

            expect(config?.rateLimit?.max).toBeGreaterThan(0);
            /** O global permite 100 por minuto. */
            expect(config?.rateLimit?.max).toBeLessThan(100);
            expect(config?.rateLimit?.timeWindow).toBeTruthy();
        });
    });

    it('o perfil público não exige autenticação', () => {
        /**
         * É esta ausência que faz o perfil ser público. Está fixada por
         * um teste para não desaparecer por descuido.
         */
        expect(preHandlersOf('GET /:username')).toHaveLength(0);
    });

    describe('personalização, que é grátis para toda a gente', () => {
        const rota = 'PATCH /me/appearance';

        /**
         * A cara e o banner de quem joga não se vendem.
         *
         * Uma pessoa sem plano continua a ser uma pessoa, e um perfil
         * cinzento ao lado de um perfil com cor não diz "aquele pagou" —
         * diz "este não conta". O que se vende é gerir uma comunidade.
         */
        it('exige sessão e mais nada', () => {
            expect(preHandlersOf(rota)).toHaveLength(1);
            expect(planoPorRota.get(rota)).toEqual([]);
        });

        it('alterar bio e avatar também não exige plano', () => {
            expect(planoPorRota.get('PATCH /me')).toEqual([]);
        });

        /**
         * Nenhuma rota deste módulo é paga.
         *
         * Escrito como lista vazia e não como "esta não é": assim, o dia
         * em que alguém puser uma parede num sítio qualquer do perfil, o
         * teste diz qual é.
         */
        it('nenhuma rota do perfil é paga', () => {
            const pagas = [...planoPorRota.entries()]
                .filter(([, kinds]) => kinds.length > 0)
                .map(([key]) => key);

            expect(pagas).toEqual([]);
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
