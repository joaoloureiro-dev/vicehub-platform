import Fastify from 'fastify';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RouteOptions } from 'fastify';

import crewRoutes from '../../src/modules/crews/crew.routes.js';
import validationPlugin from '../../src/plugins/http/validation.plugin.js';
import type { CrewController } from '../../src/modules/crews/controllers/crew.controller.js';

/**
 * Verifica que permissões cada rota de crew exige.
 *
 * É o mapa de quem pode o quê. Uma rota de gestão que perdesse o guard
 * ficaria aberta a qualquer membro, e nada mais na suite daria por isso.
 */
describe('ligação das rotas de crew', () => {
    const registered = new Map<string, RouteOptions>();
    const permissoesPorRota = new Map<string, string[]>();

    beforeAll(async () => {
        const app = Fastify();

        await app.register(validationPlugin);

        app.decorate('authenticate', vi.fn() as never);

        /**
         * O authorize devolve um preHandler; guardamos as permissões que
         * lhe foram pedidas para as poder verificar por rota.
         */
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
            leave: vi.fn(),
            acceptRequest: vi.fn(),
            rejectRequest: vi.fn(),
            removeMember: vi.fn(),
            setMemberRole: vi.fn(),
        } as unknown as CrewController;

        await app.register(crewRoutes, { controller });
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
        it.each(['GET /:crewId', 'GET /:crewId/members'])(
            '%s é acessível sem conta',
            (key) => {
                expect(preHandlerCount(key)).toBe(0);
            },
        );
    });

    describe('rotas que exigem apenas conta', () => {
        it.each(['POST /', 'POST /:crewId/join', 'POST /:crewId/leave'])(
            '%s exige autenticação mas nenhuma permissão',
            (key) => {
                expect(preHandlerCount(key)).toBe(1);
                expect(permissoesPorRota.get(key)).toEqual([]);
            },
        );
    });

    describe('rotas de gestão de membros', () => {
        it.each([
            'GET /:crewId/requests',
            'POST /:crewId/requests/:userId/accept',
            'POST /:crewId/requests/:userId/reject',
            'DELETE /:crewId/members/:userId',
            'PUT /:crewId/members/:userId/role',
        ])('%s exige crew:manage_members', (key) => {
            expect(permissoesPorRota.get(key)).toEqual(['crew:manage_members']);
        });
    });

    describe('alteração da própria crew', () => {
        it('exige crew:manage', () => {
            expect(permissoesPorRota.get('PATCH /:crewId')).toEqual(['crew:manage']);
        });
    });

    describe('validação de entrada', () => {
        it.each([
            'POST /',
            'PATCH /:crewId',
            'PUT /:crewId/members/:userId/role',
        ])('%s valida o corpo', (key) => {
            expect(registered.get(key)?.schema?.body).toBeDefined();
        });

        it.each([
            'GET /:crewId',
            'POST /:crewId/join',
            'POST /:crewId/requests/:userId/accept',
        ])('%s valida os parâmetros', (key) => {
            expect(registered.get(key)?.schema?.params).toBeDefined();
        });
    });
});
