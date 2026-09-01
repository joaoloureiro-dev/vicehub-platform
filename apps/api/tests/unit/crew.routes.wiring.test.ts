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
    const planoPorRota = new Map<string, string[]>();

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
            withdrawJoinRequest: vi.fn(),
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
            updateAppearance: vi.fn(),
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
        it.each(['GET /', 'GET /:crewId', 'GET /:crewId/members'])(
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
            'POST /:crewId/join',
            'DELETE /:crewId/join',
            'POST /:crewId/leave',
        ])('%s exige autenticação mas nenhuma permissão', (key) => {
            expect(preHandlerCount(key)).toBe(1);
            expect(permissoesPorRota.get(key)).toEqual([]);
        });

        /**
         * O diretório é estático em /me/memberships e paramétrico em
         * /:crewId. Se a rota estática deixasse de existir, o pedido
         * cairia no perfil de uma crew chamada "me" e devolveria 400 em
         * vez das candidaturas de quem pergunta.
         */
        it('as candidaturas próprias não colidem com o perfil de uma crew', () => {
            expect(registered.has('GET /me/memberships')).toBe(true);
            expect(registered.has('GET /:crewId')).toBe(true);
        });
    });

    describe('rotas de gestão de membros', () => {
        it.each([
            'GET /:crewId/requests',
            'POST /:crewId/requests/:userId/accept',
            'POST /:crewId/requests/:userId/reject',
            'DELETE /:crewId/members/:userId',
        ])('%s exige crew:manage_members', (key) => {
            expect(permissoesPorRota.get(key)).toEqual(['crew:manage_members']);
        });
    });

    describe('rotas que mexem em quem manda', () => {
        /**
         * Alterar cargos tem de exigir crew:manage e não a mera gestão de
         * membros: caso contrário um oficial podia promover um cúmplice a
         * líder e tomar a crew a quem a fundou.
         */
        it.each(['PATCH /:crewId', 'PUT /:crewId/members/:userId/role'])(
            '%s exige crew:manage',
            (key) => {
                expect(permissoesPorRota.get(key)).toEqual(['crew:manage']);
            },
        );

        it('alterar cargos não se contenta com crew:manage_members', () => {
            expect(
                permissoesPorRota.get('PUT /:crewId/members/:userId/role'),
            ).not.toContain('crew:manage_members');
        });
    });

    describe('personalização, que é funcionalidade do plano', () => {
        const rota = 'PATCH /:crewId/appearance';

        /**
         * São duas condições distintas e ambas têm de estar presentes:
         * mandar na crew não a torna premium, e ter plano não faz de
         * ninguém líder.
         */
        it('exige mandar na crew', () => {
            expect(permissoesPorRota.get(rota)).toEqual(['crew:manage']);
        });

        it('exige o plano da crew, e não o de quem faz o pedido', () => {
            expect(planoPorRota.get(rota)).toEqual(['crew']);
        });

        it('nenhuma outra rota de crew é paga', () => {
            const pagas = [...planoPorRota.entries()]
                .filter(([, kinds]) => kinds.length > 0)
                .map(([key]) => key);

            expect(pagas).toEqual([rota]);
        });
    });

    describe('validação de entrada', () => {
        it.each([
            'POST /',
            'PATCH /:crewId',
            'PATCH /:crewId/appearance',
            'PUT /:crewId/members/:userId/role',
        ])('%s valida o corpo', (key) => {
            expect(registered.get(key)?.schema?.body).toBeDefined();
        });

        it.each([
            'GET /:crewId',
            'POST /:crewId/join',
            'DELETE /:crewId/join',
            'POST /:crewId/requests/:userId/accept',
        ])('%s valida os parâmetros', (key) => {
            expect(registered.get(key)?.schema?.params).toBeDefined();
        });

        it('o diretório valida e limita os filtros de pesquisa', () => {
            expect(registered.get('GET /')?.schema?.querystring).toBeDefined();
        });
    });
});
