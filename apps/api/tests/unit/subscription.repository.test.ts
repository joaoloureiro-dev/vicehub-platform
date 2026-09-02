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
            create: ReturnType<typeof vi.fn>;
            update: ReturnType<typeof vi.fn>;
        };
        user: { findFirst: ReturnType<typeof vi.fn> };
        crew: { findFirst: ReturnType<typeof vi.fn> };
        server: { findFirst: ReturnType<typeof vi.fn> };
    };
    let repository: SubscriptionRepository;

    beforeEach(() => {
        database = {
            subscription: {
                findFirst: vi.fn(),
                findMany: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
            },
            user: { findFirst: vi.fn().mockResolvedValue(null) },
            crew: { findFirst: vi.fn().mockResolvedValue(null) },
            server: { findFirst: vi.fn().mockResolvedValue(null) },
        };
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

        /**
         * Um período por terminar **ou** a ausência de fim, que é como
         * se diz "vitalício". Sem o segundo ramo, quem tem acesso para
         * sempre deixava de o ter no instante em que a coluna passou a
         * poder ser nula.
         */
        it('aceita um período por terminar ou sem fim nenhum', () => {
            repository.findEntitlingSubscription({ userId: 'user-1' });

            expect(whereOf(database.subscription.findFirst)['OR']).toEqual([
                { current_period_end: null },
                { current_period_end: { gt: expect.any(Date) } },
            ]);
        });

        it('ignora subscrições eliminadas', () => {
            repository.findEntitlingSubscription({ userId: 'user-1' });

            expect(whereOf(database.subscription.findFirst)['is_deleted']).toBe(false);
        });

        /**
         * O vitalício vem primeiro, e a ordenação dos nulos é declarada
         * em vez de herdada do comportamento por omissão da base de
         * dados: quem tem acesso para sempre ganha a qualquer período
         * com data, por mais longe que ele esteja.
         */
        it('devolve primeiro o que não termina, depois o que expira mais tarde', () => {
            repository.findEntitlingSubscription({ userId: 'user-1' });

            const args = database.subscription.findFirst.mock.calls[0]?.[0] as {
                orderBy: unknown;
            };

            expect(args.orderBy).toEqual({
                current_period_end: { sort: 'desc', nulls: 'first' },
            });
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

    describe('existência do titular', () => {
        it.each([
            ['user', 'user'],
            ['crew', 'crew'],
            ['server', 'server'],
        ] as const)('%s é procurado na sua própria tabela', async (kind, tabela) => {
            await repository.ownerExists(kind, 'owner-1');

            expect(database[tabela].findFirst).toHaveBeenCalledWith({
                where: { id: 'owner-1', is_deleted: false },
                select: { id: true },
            });
        });

        /**
         * Um titular eliminado não pode receber plano: a conta já não
         * existe para quem a consulta, e o registo ficaria pendurado.
         */
        it('um titular eliminado não conta como existente', async () => {
            database.user.findFirst.mockResolvedValue(null);

            await expect(repository.ownerExists('user', 'user-1')).resolves.toBe(false);
        });

        it('devolve verdadeiro quando o titular existe', async () => {
            database.crew.findFirst.mockResolvedValue({ id: 'crew-1' });

            await expect(repository.ownerExists('crew', 'crew-1')).resolves.toBe(true);
        });
    });

    describe('fim do período mais distante', () => {
        it('só conta períodos por terminar e com estado que dá acesso', async () => {
            await repository.findLatestPeriodEnd({ crewId: 'crew-1' });

            const where = whereOf(database.subscription.findFirst);

            expect(where['is_deleted']).toBe(false);
            expect(where['OR']).toEqual([
                { current_period_end: null },
                { current_period_end: { gt: expect.any(Date) } },
            ]);
            expect(where['status']).toEqual({ in: ['active', 'trialing'] });
        });

        it('procura o que termina mais tarde, ou não termina', async () => {
            await repository.findLatestPeriodEnd({ userId: 'user-1' });

            const args = database.subscription.findFirst.mock.calls[0]?.[0] as {
                orderBy?: unknown;
            };

            expect(args.orderBy).toEqual({
                current_period_end: { sort: 'desc', nulls: 'first' },
            });
        });

        /**
         * O plano vem na seleção porque quem encadeia períodos precisa
         * de saber se o que já existe é vitalício: nesse caso não há
         * nada a encadear.
         */
        it('lê também o plano do período que encontrou', async () => {
            await repository.findLatestPeriodEnd({ userId: 'user-1' });

            const args = database.subscription.findFirst.mock.calls[0]?.[0] as {
                select?: Record<string, unknown>;
            };

            expect(args.select?.['plan']).toBe(true);
        });

        /**
         * Os campos ausentes ficam fixados a null. Sem isso, procurar
         * pelo utilizador devolveria também subscrições de crews cujo
         * userId calhasse ser nulo.
         */
        it('não confunde titulares de tipos diferentes', async () => {
            await repository.findLatestPeriodEnd({ crewId: 'crew-1' });

            const where = whereOf(database.subscription.findFirst);

            expect(where['userId']).toBeNull();
            expect(where['serverId']).toBeNull();
            expect(where['crewId']).toBe('crew-1');
        });
    });

    describe('gravação de um período', () => {
        const input = {
            owner: { crewId: 'crew-1' },
            plan: 'premium' as const,
            priceCents: 1_000,
            currency: 'USD',
            periodStart: new Date('2026-01-01T00:00:00.000Z'),
            periodEnd: new Date('2026-02-01T00:00:00.000Z'),
            grantedBy: 'admin-1',
        };

        const dataOf = () =>
            (database.subscription.create.mock.calls[0]?.[0] as {
                data: Record<string, unknown>;
            }).data;

        it('preenche apenas o campo do titular indicado', async () => {
            await repository.createPeriod(input);

            expect(dataOf()['crewId']).toBe('crew-1');
            expect(dataOf()['userId']).toBeNull();
            expect(dataOf()['serverId']).toBeNull();
        });

        /**
         * O preço fica gravado na linha, e não é lido do catálogo à
         * leitura: o histórico tem de continuar exato depois de uma
         * alteração de preços.
         */
        it('grava o preço e a moeda na própria linha', async () => {
            await repository.createPeriod(input);

            expect(dataOf()['price_cents']).toBe(1_000);
            expect(dataOf()['currency']).toBe('USD');
        });

        it('nasce ativa e com provedor manual', async () => {
            await repository.createPeriod(input);

            expect(dataOf()['status']).toBe('active');
            expect(dataOf()['provider']).toBe('manual');
        });

        it('regista quem concedeu', async () => {
            await repository.createPeriod(input);

            expect(dataOf()['created_by']).toBe('admin-1');
        });
    });

    describe('cancelamento', () => {
        /**
         * Quem pagou o mês fica com o mês: só deixa de haver renovação.
         * Terminar já o período seria ficar com o dinheiro e retirar o
         * acesso.
         */
        it('marca para não renovar sem encurtar o período em curso', async () => {
            await repository.markToCancelAtPeriodEnd('sub-1', 'admin-1');

            const args = database.subscription.update.mock.calls[0]?.[0] as {
                where: unknown;
                data: Record<string, unknown>;
            };

            expect(args.where).toEqual({ id: 'sub-1' });
            expect(args.data['cancel_at_period_end']).toBe(true);
            expect(args.data['canceled_at']).toBeInstanceOf(Date);
            expect(args.data).not.toHaveProperty('current_period_end');
            expect(args.data).not.toHaveProperty('ended_at');
            expect(args.data).not.toHaveProperty('status');
        });
    });
});
