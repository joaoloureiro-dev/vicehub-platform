import { SubscriptionStatus } from '@vicehub/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SubscriptionError } from '../../src/modules/subscriptions/errors/subscription.errors.js';
import { SubscriptionService } from '../../src/modules/subscriptions/services/subscription.service.js';
import type { SubscriptionRepository } from '../../src/modules/subscriptions/repositories/subscription.repository.js';

describe('SubscriptionService', () => {
    let repository: {
        findEntitlingSubscription: ReturnType<typeof vi.fn>;
        listByOwner: ReturnType<typeof vi.fn>;
        ownerExists: ReturnType<typeof vi.fn>;
        findLatestPeriodEnd: ReturnType<typeof vi.fn>;
        createPeriod: ReturnType<typeof vi.fn>;
        findById: ReturnType<typeof vi.fn>;
        markToCancelAtPeriodEnd: ReturnType<typeof vi.fn>;
    };
    let service: SubscriptionService;

    const periodEnd = new Date('2026-12-31T00:00:00.000Z');

    beforeEach(() => {
        repository = {
            findEntitlingSubscription: vi.fn().mockResolvedValue(null),
            listByOwner: vi.fn().mockResolvedValue([]),
            ownerExists: vi.fn().mockResolvedValue(true),
            findLatestPeriodEnd: vi.fn().mockResolvedValue(null),
            createPeriod: vi.fn().mockResolvedValue({ id: 'sub-1' }),
            findById: vi.fn().mockResolvedValue({
                id: 'sub-1',
                cancel_at_period_end: false,
            }),
            markToCancelAtPeriodEnd: vi.fn().mockResolvedValue({ id: 'sub-1' }),
        };
        service = new SubscriptionService(
            repository as unknown as SubscriptionRepository,
        );
    });

    describe('apuramento do direito de acesso', () => {
        it('é premium quando existe subscrição a dar acesso', async () => {
            repository.findEntitlingSubscription.mockResolvedValue({
                status: SubscriptionStatus.active,
                current_period_end: periodEnd,
            });

            await expect(service.getEntitlement({ userId: 'user-1' })).resolves.toEqual({
                owner: { userId: 'user-1' },
                isPremium: true,
                activeUntil: periodEnd,
            });
        });

        it('não é premium quando não existe nenhuma', async () => {
            const entitlement = await service.getEntitlement({ userId: 'user-1' });

            expect(entitlement.isPremium).toBe(false);
            expect(entitlement.activeUntil).toBeNull();
        });

        it('funciona para crews e servidores', async () => {
            await service.getEntitlement({ crewId: 'crew-1' });
            await service.getEntitlement({ serverId: 'server-1' });

            expect(repository.findEntitlingSubscription).toHaveBeenNthCalledWith(1, {
                crewId: 'crew-1',
            });
            expect(repository.findEntitlingSubscription).toHaveBeenNthCalledWith(2, {
                serverId: 'server-1',
            });
        });
    });

    describe('titular', () => {
        const expectInvalidOwner = async (owner: Record<string, string>) => {
            const error = await service
                .getEntitlement(owner)
                .catch((caught: unknown) => caught);

            expect(error).toBeInstanceOf(SubscriptionError);
            expect((error as SubscriptionError).code).toBe('INVALID_SUBSCRIPTION_OWNER');
        };

        it('recusa um titular vazio', async () => {
            await expectInvalidOwner({});
            expect(repository.findEntitlingSubscription).not.toHaveBeenCalled();
        });

        it('recusa dois titulares em simultâneo', async () => {
            /**
             * A base de dados garante o mesmo com um CHECK. Verificar aqui
             * evita uma consulta que devolveria silenciosamente o titular
             * errado.
             */
            await expectInvalidOwner({ userId: 'user-1', crewId: 'crew-1' });
        });

        it('recusa os três em simultâneo', async () => {
            await expectInvalidOwner({
                userId: 'user-1',
                crewId: 'crew-1',
                serverId: 'server-1',
            });
        });

        it('valida o titular também ao listar o histórico', async () => {
            await expect(service.listHistory({})).rejects.toBeInstanceOf(
                SubscriptionError,
            );
        });
    });

    describe('assertPremium', () => {
        it('deixa passar quem tem plano ativo', () => {
            expect(() =>
                service.assertPremium({
                    owner: { userId: 'user-1' },
                    isPremium: true,
                    activeUntil: periodEnd,
                }),
            ).not.toThrow();
        });

        it('recusa quem não tem, com SUBSCRIPTION_REQUIRED', () => {
            try {
                service.assertPremium({
                    owner: { userId: 'user-1' },
                    isPremium: false,
                    activeUntil: null,
                });
                expect.unreachable('devia ter lançado');
            } catch (error: unknown) {
                expect(error).toBeInstanceOf(SubscriptionError);
                expect((error as SubscriptionError).code).toBe('SUBSCRIPTION_REQUIRED');
            }
        });
    });

    describe('histórico', () => {
        it('devolve o que o repositório encontrar', async () => {
            repository.listByOwner.mockResolvedValue([{ id: 'sub-2' }, { id: 'sub-1' }]);

            await expect(service.listHistory({ userId: 'user-1' })).resolves.toHaveLength(
                2,
            );
        });
    });

    describe('concessão de um período', () => {
        const expectSubscriptionError = async (
            promise: Promise<unknown>,
            code: string,
        ) => {
            const error = await promise.catch((caught: unknown) => caught);

            expect(error).toBeInstanceOf(SubscriptionError);
            expect((error as SubscriptionError).code).toBe(code);
        };

        it('recusa conceder a um titular que não existe', async () => {
            repository.ownerExists.mockResolvedValue(false);

            await expectSubscriptionError(
                service.grant({
                    ownerKind: 'crew',
                    ownerId: 'crew-1',
                    grantedBy: 'admin-1',
                }),
                'SUBSCRIPTION_OWNER_NOT_FOUND',
            );

            expect(repository.createPeriod).not.toHaveBeenCalled();
        });

        it('grava o preço do catálogo, e não um preço enviado no pedido', async () => {
            await service.grant({
                ownerKind: 'user',
                ownerId: 'user-1',
                grantedBy: 'admin-1',
            });

            expect(repository.createPeriod).toHaveBeenCalledWith(
                expect.objectContaining({ priceCents: 1000, currency: 'USD' }),
            );
        });

        it('sem plano em vigor, o período começa agora', async () => {
            const antes = Date.now();

            await service.grant({
                ownerKind: 'user',
                ownerId: 'user-1',
                grantedBy: 'admin-1',
            });

            const { periodStart } = repository.createPeriod.mock.calls[0]?.[0] as {
                periodStart: Date;
            };

            expect(periodStart.getTime()).toBeGreaterThanOrEqual(antes);
        });

        /**
         * Dois períodos sobrepostos fariam o histórico deixar de dizer
         * por quanto tempo se pagou — que é exatamente o que estes
         * registos existem para responder.
         */
        it('com plano em vigor, o período novo começa onde o anterior acaba', async () => {
            const fimAtual = new Date('2026-10-01T00:00:00.000Z');

            repository.findLatestPeriodEnd.mockResolvedValue({
                current_period_end: fimAtual,
            });

            await service.grant({
                ownerKind: 'crew',
                ownerId: 'crew-1',
                grantedBy: 'admin-1',
            });

            const { periodStart, periodEnd: fimNovo } = repository.createPeriod.mock
                .calls[0]?.[0] as { periodStart: Date; periodEnd: Date };

            expect(periodStart).toEqual(fimAtual);
            expect(fimNovo).toEqual(new Date('2026-11-01T00:00:00.000Z'));
        });

        it('um mês é o intervalo por omissão do plano', async () => {
            repository.findLatestPeriodEnd.mockResolvedValue({
                current_period_end: new Date('2026-01-31T00:00:00.000Z'),
            });

            await service.grant({
                ownerKind: 'user',
                ownerId: 'user-1',
                grantedBy: 'admin-1',
            });

            const { periodEnd: fim } = repository.createPeriod.mock.calls[0]?.[0] as {
                periodEnd: Date;
            };

            expect(fim).toEqual(new Date('2026-02-28T00:00:00.000Z'));
        });

        it('a duração pedida estende o período em conformidade', async () => {
            repository.findLatestPeriodEnd.mockResolvedValue({
                current_period_end: new Date('2026-01-01T00:00:00.000Z'),
            });

            await service.grant({
                ownerKind: 'server',
                ownerId: 'server-1',
                grantedBy: 'admin-1',
                months: 6,
            });

            const { periodEnd: fim } = repository.createPeriod.mock.calls[0]?.[0] as {
                periodEnd: Date;
            };

            expect(fim).toEqual(new Date('2026-07-01T00:00:00.000Z'));
        });

        it.each([
            ['user', { userId: 'owner-1' }],
            ['crew', { crewId: 'owner-1' }],
            ['server', { serverId: 'owner-1' }],
        ] as const)('o titular %s fica no campo que lhe corresponde', async (kind, esperado) => {
            await service.grant({
                ownerKind: kind,
                ownerId: 'owner-1',
                grantedBy: 'admin-1',
            });

            expect(repository.createPeriod).toHaveBeenCalledWith(
                expect.objectContaining({ owner: esperado }),
            );
        });

        it('regista quem concedeu', async () => {
            await service.grant({
                ownerKind: 'user',
                ownerId: 'user-1',
                grantedBy: 'admin-1',
            });

            expect(repository.createPeriod).toHaveBeenCalledWith(
                expect.objectContaining({ grantedBy: 'admin-1' }),
            );
        });
    });

    describe('cancelamento', () => {
        const expectSubscriptionError = async (
            promise: Promise<unknown>,
            code: string,
        ) => {
            const error = await promise.catch((caught: unknown) => caught);

            expect(error).toBeInstanceOf(SubscriptionError);
            expect((error as SubscriptionError).code).toBe(code);
        };

        it('marca para não renovar no fim do período', async () => {
            await service.cancelAtPeriodEnd('sub-1', 'admin-1');

            expect(repository.markToCancelAtPeriodEnd).toHaveBeenCalledWith(
                'sub-1',
                'admin-1',
            );
        });

        it('recusa cancelar uma subscrição que não existe', async () => {
            repository.findById.mockResolvedValue(null);

            await expectSubscriptionError(
                service.cancelAtPeriodEnd('sub-1', 'admin-1'),
                'SUBSCRIPTION_NOT_FOUND',
            );

            expect(repository.markToCancelAtPeriodEnd).not.toHaveBeenCalled();
        });

        it('recusa cancelar duas vezes', async () => {
            repository.findById.mockResolvedValue({
                id: 'sub-1',
                cancel_at_period_end: true,
            });

            await expectSubscriptionError(
                service.cancelAtPeriodEnd('sub-1', 'admin-1'),
                'SUBSCRIPTION_ALREADY_CANCELED',
            );

            expect(repository.markToCancelAtPeriodEnd).not.toHaveBeenCalled();
        });
    });
});
