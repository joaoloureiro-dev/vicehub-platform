import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SubscriptionRepository } from '../../src/modules/subscriptions/repositories/subscription.repository.js';
import type { DatabaseClient } from '@vicehub/database';

/**
 * Testes à forma da consulta de subscrições.
 *
 * É aqui que se decide o que conta como plano ativo. Um filtro em falta
 * daria acesso premium a quem já não o tem.
 */
describe('SubscriptionRepository', () => {
    let database: {
        subscription: {
            findFirst: ReturnType<typeof vi.fn>;
            findMany: ReturnType<typeof vi.fn>;
        };
    };
    let repository: SubscriptionRepository;

    beforeEach(() => {
        database = { subscription: { findFirst: vi.fn(), findMany: vi.fn() } };
        repository = new SubscriptionRepository(
            database as unknown as DatabaseClient,
        );
    });

    const whereOf = (mock: ReturnType<typeof vi.fn>): Record<string, unknown> => {
        const args = (mock.mock.calls[0]?.[0] ?? {}) as {
            where?: Record<string, unknown>;
        };

        return args.where ?? {};
    };

    describe('findEntitlingSubscription', () => {
        it('só aceita estados que dão direito ao plano', () => {
            repository.findEntitlingSubscription({ userId: 'user-1' });

            /**
             * past_due fica de fora: enquanto o pagamento estiver em falta
             * o acesso não é concedido.
             */
            expect(whereOf(database.subscription.findFirst)['status']).toEqual({
                in: ['active', 'trialing'],
            });
        });

        it('exige que o período ainda não tenha terminado', () => {
            repository.findEntitlingSubscription({ userId: 'user-1' });

            expect(whereOf(database.subscription.findFirst)['current_period_end']).toEqual(
                { gt: expect.any(Date) },
            );
        });

        it('ignora subscrições eliminadas', () => {
            repository.findEntitlingSubscription({ userId: 'user-1' });

            expect(whereOf(database.subscription.findFirst)['is_deleted']).toBe(false);
        });

        it('devolve a que expira mais tarde', () => {
            repository.findEntitlingSubscription({ userId: 'user-1' });

            const args = database.subscription.findFirst.mock.calls[0]?.[0] as {
                orderBy: unknown;
            };

            expect(args.orderBy).toEqual({ current_period_end: 'desc' });
        });
    });

    describe('filtro do titular', () => {
        it('fixa a null os titulares não indicados', () => {
            repository.findEntitlingSubscription({ userId: 'user-1' });

            /**
             * Sem isto, procurar pelo utilizador apanharia também
             * subscrições de crews cujo userId calhasse ser nulo.
             */
            expect(whereOf(database.subscription.findFirst)).toMatchObject({
                userId: 'user-1',
                crewId: null,
                serverId: null,
            });
        });

        it('filtra por crew sem apanhar as de utilizador', () => {
            repository.findEntitlingSubscription({ crewId: 'crew-1' });

            expect(whereOf(database.subscription.findFirst)).toMatchObject({
                userId: null,
                crewId: 'crew-1',
                serverId: null,
            });
        });

        it('filtra por servidor', () => {
            repository.findEntitlingSubscription({ serverId: 'server-1' });

            expect(whereOf(database.subscription.findFirst)).toMatchObject({
                userId: null,
                crewId: null,
                serverId: 'server-1',
            });
        });
    });

    describe('listByOwner', () => {
        it('devolve o histórico do mais recente para o mais antigo', () => {
            repository.listByOwner({ userId: 'user-1' });

            const args = database.subscription.findMany.mock.calls[0]?.[0] as {
                orderBy: unknown;
            };

            expect(args.orderBy).toEqual({ current_period_start: 'desc' });
        });

        it('não filtra por estado, porque é histórico', () => {
            repository.listByOwner({ userId: 'user-1' });

            expect(whereOf(database.subscription.findMany)['status']).toBeUndefined();
        });
    });
});
