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
            create: vi.fn(),
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
        it.each(['GET /:serverId', 'GET /:serverId/members'])(
            '%s é acessível sem conta',
            (key) => {
                expect(preHandlerCount(key)).toBe(0);
            },
        );
    });

    describe('rotas que exigem apenas conta', () => {
        it.each([
            'POST /',
            'POST /:serverId/join',
            'DELETE /:serverId/join',
            'POST /:serverId/leave',
        ])('%s exige autenticação mas nenhuma permissão', (key) => {
            expect(preHandlerCount(key)).toBe(1);
            expect(permissoesPorRota.get(key)).toEqual([]);
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

    describe('validação de entrada', () => {
        it.each(['POST /', 'PATCH /:serverId', 'PUT /:serverId/members/:userId/role'])(
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
    });
});
