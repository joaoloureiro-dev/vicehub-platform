import Fastify from 'fastify';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RouteOptions } from 'fastify';

import treasuryRoutes from '../../src/modules/treasury/treasury.routes.js';
import validationPlugin from '../../src/plugins/http/validation.plugin.js';
import type { TreasuryController } from '../../src/modules/treasury/controllers/treasury.controller.js';

/**
 * Verifica que permissões cada rota de tesouraria exige.
 *
 * O saldo de uma comunidade e a lista do que gastou não podem ficar
 * acessíveis a quem passa por lá.
 */
describe('ligação das rotas de tesouraria', () => {
    const registered = new Map<string, RouteOptions>();
    const permissoesPorRota = new Map<string, string[]>();

    beforeAll(async () => {
        const app = Fastify();

        await app.register(validationPlugin);

        app.decorate('authenticate', vi.fn() as never);

        const pedidas = new Map<unknown, string[]>();

        app.decorate('authorize', ((...permissions: string[]) => {
            const handler = vi.fn();
            pedidas.set(handler, permissions);
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

            permissoesPorRota.set(
                key,
                preHandlers.flatMap((handler) => pedidas.get(handler) ?? []),
            );
        });

        const controller = {
            getMine: vi.fn(),
            getCrew: vi.fn(),
            getServer: vi.fn(),
        } as unknown as TreasuryController;

        await app.register(treasuryRoutes, { controller });
        await app.ready();
        await app.close();
    });

    const preHandlerCount = (key: string): number => {
        const route = registered.get(key);

        expect(route, `rota ${key} não registada`).toBeDefined();

        const preHandler = route?.preHandler;

        if (!preHandler) {
            return 0;
        }

        return Array.isArray(preHandler) ? preHandler.length : 1;
    };

    it('nenhuma rota de tesouraria é pública', () => {
        expect(registered.size).toBeGreaterThan(0);

        for (const key of registered.keys()) {
            expect(preHandlerCount(key), `rota ${key}`).toBeGreaterThanOrEqual(1);
        }
    });

    it('a própria carteira exige conta mas nenhuma permissão', () => {
        expect(preHandlerCount('GET /me')).toBe(1);
        expect(permissoesPorRota.get('GET /me')).toEqual([]);
    });

    it.each(['GET /crews/:crewId', 'GET /servers/:serverId'])(
        '%s exige treasury:read',
        (key) => {
            expect(permissoesPorRota.get(key)).toEqual(['treasury:read']);
        },
    );

    /**
     * O âmbito é lido do parâmetro da rota pelo guard. Um nome diferente
     * de crewId ou serverId deixaria o guard sem âmbito, e um cargo
     * noutra crew passaria a dar acesso à tesouraria desta.
     */
    it.each([
        ['GET /crews/:crewId', ':crewId'],
        ['GET /servers/:serverId', ':serverId'],
    ])('%s nomeia o parâmetro que o guard lê', (key, parametro) => {
        expect(key).toContain(parametro);
    });

    describe('validação de entrada', () => {
        it.each(['GET /crews/:crewId', 'GET /servers/:serverId'])(
            '%s valida os parâmetros',
            (key) => {
                expect(registered.get(key)?.schema?.params).toBeDefined();
            },
        );

        it.each(['GET /me', 'GET /crews/:crewId', 'GET /servers/:serverId'])(
            '%s limita o extrato pedido',
            (key) => {
                expect(registered.get(key)?.schema?.querystring).toBeDefined();
            },
        );
    });
});
