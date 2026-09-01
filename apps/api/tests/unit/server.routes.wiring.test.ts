import Fastify from 'fastify';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RouteOptions } from 'fastify';

import serverRoutes from '../../src/modules/servers/server.routes.js';
import validationPlugin from '../../src/plugins/http/validation.plugin.js';
import type { ServerController } from '../../src/modules/servers/controllers/server.controller.js';

/**
 * Verifica que permissões cada rota de servidor exige.
 *
 * É o mapa de quem pode o quê. Uma rota de gestão que perdesse o guard
 * ficaria aberta a qualquer membro, e nada mais na suite daria por isso.
 */
describe('ligação das rotas de servidor', () => {
    const registered = new Map<string, RouteOptions>();
    const permissoesPorRota = new Map<string, string[]>();
    const planoPorRota = new Map<string, string[]>();

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


        /**
         * O requirePremium devolve um preHandler; guardamos o titular
         * cujo plano cada rota exige. Numa rota com crewId, exigir o
         * plano da crew ou o de quem faz o pedido são coisas diferentes,
         * e é essa escolha que interessa fixar.
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

            permissoesPorRota.set(
                key,
                preHandlers.flatMap((handler) => pedidas.get(handler) ?? []),
            );

            planoPorRota.set(
                key,
                preHandlers.flatMap((handler) => {
                    const kind = planos.get(handler);

                    return kind === undefined ? [] : [kind];
                }),
            );
        });

        const controller = {
            create: vi.fn(),
            listDirectory: vi.fn(),
            listMyMemberships: vi.fn(),
            getProfile: vi.fn(),
            update: vi.fn(),
            listMembers: vi.fn(),
            listJoinRequests: vi.fn(),
            requestToJoin: vi.fn(),
            withdrawJoinRequest: vi.fn(),
            leave: vi.fn(),
            acceptRequest: vi.fn(),
            rejectRequest: vi.fn(),
            removeMember: vi.fn(),
            setMemberRole: vi.fn(),
            updateAppearance: vi.fn(),
        } as unknown as ServerController;

        await app.register(serverRoutes, { controller });
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

    describe('rotas públicas', () => {
        it.each(['GET /', 'GET /:serverId', 'GET /:serverId/members'])(
            '%s é acessível sem conta',
            (key) => {
                expect(preHandlerCount(key)).toBe(0);
            },
        );
    });

    describe('rotas que exigem apenas conta', () => {
        it.each([
            'POST /',
            'GET /me/memberships',
            'POST /:serverId/join',
            'DELETE /:serverId/join',
            'POST /:serverId/leave',
        ])('%s exige autenticação mas nenhuma permissão', (key) => {
            expect(preHandlerCount(key)).toBe(1);
            expect(permissoesPorRota.get(key)).toEqual([]);
        });

        /**
         * O diretório é estático em /me/memberships e paramétrico em
         * /:serverId. Se a rota estática deixasse de existir, o pedido
         * cairia no perfil de um servidor chamado "me" e devolveria 400
         * em vez das candidaturas de quem pergunta.
         */
        it('as candidaturas próprias não colidem com o perfil de um servidor', () => {
            expect(registered.has('GET /me/memberships')).toBe(true);
            expect(registered.has('GET /:serverId')).toBe(true);
        });
    });

    describe('rotas de gestão de membros', () => {
        it.each([
            'GET /:serverId/requests',
            'POST /:serverId/requests/:userId/accept',
            'POST /:serverId/requests/:userId/reject',
            'DELETE /:serverId/members/:userId',
        ])('%s exige server:manage_members', (key) => {
            expect(permissoesPorRota.get(key)).toEqual(['server:manage_members']);
        });
    });

    describe('rotas que mexem em quem manda', () => {
        /**
         * Alterar cargos tem de exigir server:manage e não a mera gestão
         * de membros: caso contrário um moderador podia promover um
         * cúmplice a dono e tomar o servidor a quem o criou.
         */
        it.each(['PATCH /:serverId', 'PUT /:serverId/members/:userId/role'])(
            '%s exige server:manage',
            (key) => {
                expect(permissoesPorRota.get(key)).toEqual(['server:manage']);
            },
        );

        it('alterar cargos não se contenta com server:manage_members', () => {
            expect(
                permissoesPorRota.get('PUT /:serverId/members/:userId/role'),
            ).not.toContain('server:manage_members');
        });
    });

    describe('personalização, que é funcionalidade do plano', () => {
        const rota = 'PATCH /:serverId/appearance';

        /**
         * São duas condições distintas e ambas têm de estar presentes:
         * mandar no servidor não o torna premium, e ter plano não faz de
         * ninguém dono.
         */
        it('exige mandar no servidor', () => {
            expect(permissoesPorRota.get(rota)).toEqual(['server:manage']);
        });

        it('exige o plano do servidor, e não o de quem faz o pedido', () => {
            expect(planoPorRota.get(rota)).toEqual(['server']);
        });

        it('nenhuma outra rota de servidor é paga', () => {
            const pagas = [...planoPorRota.entries()]
                .filter(([, kinds]) => kinds.length > 0)
                .map(([key]) => key);

            expect(pagas).toEqual([rota]);
        });
    });

    describe('validação de entrada', () => {
        it.each([
            'POST /',
            'PATCH /:serverId',
            'PATCH /:serverId/appearance',
            'PUT /:serverId/members/:userId/role',
        ])(
            '%s valida o corpo',
            (key) => {
                expect(registered.get(key)?.schema?.body).toBeDefined();
            },
        );

        it.each([
            'GET /:serverId',
            'POST /:serverId/join',
            'DELETE /:serverId/join',
            'POST /:serverId/requests/:userId/accept',
        ])('%s valida os parâmetros', (key) => {
            expect(registered.get(key)?.schema?.params).toBeDefined();
        });

        it('o diretório valida e limita os filtros de pesquisa', () => {
            expect(registered.get('GET /')?.schema?.querystring).toBeDefined();
        });
    });
});
