import Fastify from 'fastify';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RouteOptions } from 'fastify';

import eventRoutes from '../../src/modules/events/event.routes.js';
import validationPlugin from '../../src/plugins/http/validation.plugin.js';
import type { EventController } from '../../src/modules/events/controllers/event.controller.js';

/**
 * Verifica que permissões cada rota de eventos exige.
 *
 * A rota que mais importa é a de confirmar presenças: é ela que dá
 * direito a receber parte dos ganhos, e se perdesse o guard qualquer
 * membro podia atribuir-se uma participação e ser pago por ela.
 */
describe('ligação das rotas de eventos', () => {
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
            list: vi.fn(),
            get: vi.fn(),
            update: vi.fn(),
            transition: vi.fn(),
            signUp: vi.fn(),
            withdraw: vi.fn(),
            listParticipants: vi.fn(),
            confirmAttendance: vi.fn(),
            markNoShow: vi.fn(),
        } as unknown as EventController;

        await app.register(eventRoutes, { controller });
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

    /**
     * As rotas são declaradas uma vez e registadas com os dois prefixos.
     * Este teste é o que garante que continua assim: sem ele, uma rota
     * nova podia ficar só nas crews e ninguém dava por isso até um
     * servidor tentar usá-la.
     */
    describe('estão registadas para crews e para servidores', () => {
        const caminhos = [
            ['GET', ''],
            ['POST', ''],
            ['GET', '/:eventId'],
            ['PATCH', '/:eventId'],
            ['POST', '/:eventId/status'],
            ['POST', '/:eventId/signup'],
            ['DELETE', '/:eventId/signup'],
            ['GET', '/:eventId/participants'],
            ['POST', '/:eventId/participants/:userId/confirm'],
            ['POST', '/:eventId/participants/:userId/no-show'],
        ] as const;

        it.each(caminhos)('%s %s existe nos dois âmbitos', (metodo, caminho) => {
            expect(registered.has(`${metodo} /crews/:crewId${caminho}`)).toBe(true);
            expect(registered.has(`${metodo} /servers/:serverId${caminho}`)).toBe(
                true,
            );
        });

        it('os dois âmbitos exigem exatamente as mesmas permissões', () => {
            for (const [metodo, caminho] of caminhos) {
                expect(
                    permissoesPorRota.get(`${metodo} /servers/:serverId${caminho}`),
                    `${metodo} ${caminho}`,
                ).toEqual(
                    permissoesPorRota.get(`${metodo} /crews/:crewId${caminho}`),
                );
            }
        });
    });

    describe('quem pode o quê numa crew', () => {
        it.each([
            'GET /crews/:crewId',
            'GET /crews/:crewId/:eventId',
            'GET /crews/:crewId/:eventId/participants',
        ])('%s exige event:read', (key) => {
            expect(permissoesPorRota.get(key)).toEqual(['event:read']);
        });

        it.each([
            'POST /crews/:crewId',
            'PATCH /crews/:crewId/:eventId',
            'POST /crews/:crewId/:eventId/status',
        ])('%s exige event:manage', (key) => {
            expect(permissoesPorRota.get(key)).toEqual(['event:manage']);
        });

        /**
         * Confirmar uma presença é o que dá direito a ser pago, e por
         * isso não se contenta com event:manage: organizar um evento e
         * decidir quem é pago por ele são poderes distintos, e uma
         * comunidade pode querer dar um sem dar o outro.
         */
        it.each([
            'POST /crews/:crewId/:eventId/participants/:userId/confirm',
            'POST /crews/:crewId/:eventId/participants/:userId/no-show',
        ])('%s exige event:confirm_attendance', (key) => {
            expect(permissoesPorRota.get(key)).toEqual([
                'event:confirm_attendance',
            ]);
        });

        it('confirmar presenças não se contenta com event:manage', () => {
            expect(
                permissoesPorRota.get(
                    'POST /crews/:crewId/:eventId/participants/:userId/confirm',
                ),
            ).not.toContain('event:manage');
        });
    });

    /**
     * Inscrever-se diz respeito ao próprio: exige conta, mas nenhuma
     * permissão de gestão. Quem pertence à comunidade é verificado no
     * serviço, que é onde se sabe de que crew é o evento.
     */
    describe('inscrever-se e desistir', () => {
        it.each([
            'POST /crews/:crewId/:eventId/signup',
            'DELETE /crews/:crewId/:eventId/signup',
        ])('%s exige apenas conta', (key) => {
            expect(preHandlerCount(key)).toBe(1);
            expect(permissoesPorRota.get(key)).toEqual([]);
        });
    });

    /**
     * Nenhuma rota de eventos é pública. O calendário de uma comunidade
     * diz quando e onde ela vai estar, e isso é dela.
     */
    it('não há rotas de eventos sem autenticação', () => {
        /**
         * O HEAD é gerado pelo Fastify a partir do GET e herda-lhe os
         * guards, por isso não é o que interessa verificar aqui.
         */
        const rotas = [...registered.keys()].filter(
            (key) => !key.startsWith('HEAD '),
        );

        expect(rotas.length).toBeGreaterThan(0);

        for (const key of rotas) {
            expect(preHandlerCount(key), key).toBeGreaterThan(0);
        }
    });

    describe('validação de entrada', () => {
        it.each([
            'POST /crews/:crewId',
            'PATCH /crews/:crewId/:eventId',
            'POST /crews/:crewId/:eventId/status',
            'POST /crews/:crewId/:eventId/participants/:userId/confirm',
        ])('%s valida o corpo', (key) => {
            expect(registered.get(key)?.schema?.body).toBeDefined();
        });

        it.each([
            'GET /crews/:crewId/:eventId',
            'POST /crews/:crewId/:eventId/signup',
            'POST /crews/:crewId/:eventId/participants/:userId/no-show',
        ])('%s valida os parâmetros', (key) => {
            expect(registered.get(key)?.schema?.params).toBeDefined();
        });

        it('a listagem valida e limita os filtros', () => {
            expect(
                registered.get('GET /crews/:crewId')?.schema?.querystring,
            ).toBeDefined();
        });
    });
});
