import Fastify from 'fastify';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RouteOptions } from 'fastify';

import subscriptionRoutes from '../../src/modules/subscriptions/subscription.routes.js';
import validationPlugin from '../../src/plugins/http/validation.plugin.js';
import type { SubscriptionController } from '../../src/modules/subscriptions/controllers/subscription.controller.js';

/**
 * Verifica que permissões cada rota de subscrição exige.
 *
 * Conceder um plano é dar acesso pago de graça. Uma rota destas sem
 * guard seria a falha mais cara do sistema, e nada mais na suite daria
 * por isso.
 */
describe('ligação das rotas de subscrição', () => {
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
            grant: vi.fn(),
            cancel: vi.fn(),
            revoke: vi.fn(),
            getMine: vi.fn(),
            getCrew: vi.fn(),
            getServer: vi.fn(),
        } as unknown as SubscriptionController;

        await app.register(subscriptionRoutes, { controller });
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

    describe('conceder, cancelar e revogar', () => {
        /**
         * Dar e tirar acesso pago são atos de administração. Em
         * particular, revogar tem de exigir o mesmo que conceder: seria
         * absurdo que retirar um vitalício fosse mais fácil do que dá-lo.
         */
        it.each([
            'POST /grant',
            'POST /:subscriptionId/cancel',
            'POST /:subscriptionId/revoke',
        ])('%s exige system:manage', (key) => {
            expect(permissoesPorRota.get(key)).toEqual(['system:manage']);
        });

        /**
         * Nenhuma rota de subscrição pode estar aberta: a mais barata
         * delas revela quanto se pagou, e a mais cara concede o plano.
         */
        it('nenhuma rota do módulo é acessível sem conta', () => {
            for (const key of registered.keys()) {
                expect(preHandlerCount(key), `rota ${key}`).toBeGreaterThanOrEqual(1);
            }
        });
    });

    describe('consulta', () => {
        it('o próprio vê o seu plano sem precisar de permissão', () => {
            expect(preHandlerCount('GET /me')).toBe(1);
            expect(permissoesPorRota.get('GET /me')).toEqual([]);
        });

        /**
         * O perfil público já diz se há plano ativo. O que estas rotas
         * acrescentam é quanto e desde quando, que é de quem manda lá
         * dentro e não de qualquer membro.
         */
        it('o histórico de uma crew exige crew:manage', () => {
            expect(permissoesPorRota.get('GET /crews/:crewId')).toEqual([
                'crew:manage',
            ]);
        });

        it('o histórico de um servidor exige server:manage', () => {
            expect(permissoesPorRota.get('GET /servers/:serverId')).toEqual([
                'server:manage',
            ]);
        });

        /**
         * O âmbito é lido do parâmetro da rota pelo guard. Um nome
         * diferente de crewId ou serverId deixaria o guard sem âmbito, e
         * um cargo noutra crew passaria a servir.
         */
        it.each([
            ['GET /crews/:crewId', ':crewId'],
            ['GET /servers/:serverId', ':serverId'],
        ])('%s nomeia o parâmetro que o guard lê', (key, parametro) => {
            expect(key).toContain(parametro);
        });
    });

    describe('validação de entrada', () => {
        it('a concessão valida o corpo', () => {
            expect(registered.get('POST /grant')?.schema?.body).toBeDefined();
        });

        it.each([
            'POST /:subscriptionId/revoke',
            'POST /:subscriptionId/cancel',
            'GET /crews/:crewId',
            'GET /servers/:serverId',
        ])('%s valida os parâmetros', (key) => {
            expect(registered.get(key)?.schema?.params).toBeDefined();
        });
    });
});
