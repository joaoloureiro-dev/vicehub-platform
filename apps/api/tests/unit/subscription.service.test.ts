import { SubscriptionStatus } from '@vicehub/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SubscriptionError } from '../../src/modules/subscriptions/errors/subscription.errors.js';
import { SubscriptionService } from '../../src/modules/subscriptions/services/subscription.service.js';
import type { SubscriptionRepository } from '../../src/modules/subscriptions/repositories/subscription.repository.js';

describe('SubscriptionService', () => {
    let repository: {
        findEntitlingSubscription: ReturnType<typeof vi.fn>;
        listByOwner: ReturnType<typeof vi.fn>;
    };
    let service: SubscriptionService;

    const periodEnd = new Date('2026-12-31T00:00:00.000Z');

    beforeEach(() => {
        repository = {
            findEntitlingSubscription: vi.fn().mockResolvedValue(null),
            listByOwner: vi.fn().mockResolvedValue([]),
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
});
