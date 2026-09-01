import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    InsufficientFundsSignal,
    TreasuryRepository,
} from '../../src/modules/treasury/repositories/treasury.repository.js';
import type { DatabaseClient } from '@vicehub/database';

/**
 * Testes à forma das escritas da tesouraria.
 *
 * Os testes do serviço verificam que o repositório é chamado; estes
 * verificam o que ele grava. Sem eles, um movimento que nascesse já
 * aprovado passaria a suite inteira.
 */
describe('TreasuryRepository', () => {
    let database: {
        wallet: {
            findFirst: ReturnType<typeof vi.fn>;
            create: ReturnType<typeof vi.fn>;
        };
        transaction: {
            findFirst: ReturnType<typeof vi.fn>;
            findMany: ReturnType<typeof vi.fn>;
            create: ReturnType<typeof vi.fn>;
            updateMany: ReturnType<typeof vi.fn>;
            groupBy: ReturnType<typeof vi.fn>;
        };
    };
    let repository: TreasuryRepository;

    beforeEach(() => {
        database = {
            wallet: { findFirst: vi.fn(), create: vi.fn() },
            transaction: {
                findFirst: vi.fn(),
                findMany: vi.fn(),
                create: vi.fn(),
                updateMany: vi.fn(),
                groupBy: vi.fn().mockResolvedValue([]),
            },
        };
        repository = new TreasuryRepository(database as unknown as DatabaseClient);
    });

    /**
     * A aprovação corre dentro de uma transação da base de dados. Para a
     * poder observar, o duplo do $transaction chama o próprio callback
     * com um cliente igualmente falso — é a única forma de verificar as
     * condições de escrita sem uma base de dados a sério.
     */
    const withTransaction = () => {
        const tx = {
            transaction: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
            wallet: {
                update: vi.fn().mockResolvedValue({}),
                updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
        };

        (database as unknown as {
            $transaction: (fn: (client: unknown) => unknown) => unknown;
        }).$transaction = (fn) => fn(tx);

        repository = new TreasuryRepository(database as unknown as DatabaseClient);

        return tx;
    };

    describe('criar um movimento', () => {
        const input = {
            walletId: 'wallet-1',
            amount: 2_500n,
            direction: 'debit' as const,
            category: 'server_costs' as const,
            description: 'Servidor de outubro',
            requestedBy: 'officer-1',
        };

        const dataOf = () =>
            (database.transaction.create.mock.calls[0]?.[0] as {
                data: Record<string, unknown>;
            }).data;

        /**
         * É a propriedade central de todo o desenho: propor não é mover.
         * Um movimento que nascesse aprovado saltaria a decisão por
         * inteiro, e o dinheiro sairia sem ninguém o autorizar.
         */
        it('nasce sempre pendente', async () => {
            await repository.createMovement(input);

            expect(dataOf()['status']).toBe('pending');
        });

        it('nasce sem quem decidiu, porque ninguém decidiu ainda', async () => {
            await repository.createMovement(input);

            expect(dataOf()['decided_by']).toBeUndefined();
            expect(dataOf()['decided_at']).toBeUndefined();
        });

        it('grava montante, sentido e rubrica tal como foram pedidos', async () => {
            await repository.createMovement(input);

            expect(dataOf()['amount']).toBe(2_500n);
            expect(dataOf()['direction']).toBe('debit');
            expect(dataOf()['category']).toBe('server_costs');
        });

        it('regista quem propôs', async () => {
            await repository.createMovement(input);

            expect(dataOf()['requested_by']).toBe('officer-1');
        });
    });

    describe('encerrar um movimento', () => {
        const argsOf = () =>
            database.transaction.updateMany.mock.calls[0]?.[0] as {
                where: Record<string, unknown>;
                data: Record<string, unknown>;
            };

        /**
         * A condição ao estado pendente é o que impede decidir duas vezes
         * o mesmo movimento: a segunda escrita não encontra linha nenhuma.
         */
        it('só encerra o que ainda está pendente', async () => {
            await repository.closeMovement({
                movementId: 'mov-1',
                status: 'rejected',
                decidedBy: 'leader-1',
            });

            expect(argsOf().where).toEqual({ id: 'mov-1', status: 'pending' });
        });

        it('regista quem decidiu e quando', async () => {
            await repository.closeMovement({
                movementId: 'mov-1',
                status: 'rejected',
                decidedBy: 'leader-1',
            });

            expect(argsOf().data['status']).toBe('rejected');
            expect(argsOf().data['decided_by']).toBe('leader-1');
            expect(argsOf().data['decided_at']).toBeInstanceOf(Date);
        });

        /**
         * Encerrar não é aprovar: recusar ou retirar nunca pode tocar no
         * saldo da carteira.
         */
        it('não mexe em carteira nenhuma', async () => {
            await repository.closeMovement({
                movementId: 'mov-1',
                status: 'canceled',
                decidedBy: 'officer-1',
            });

            expect(database.wallet.create).not.toHaveBeenCalled();
        });
    });

    describe('leitura de movimentos', () => {
        it('ignora os eliminados', async () => {
            await repository.findMovementById('mov-1');

            expect(database.transaction.findFirst).toHaveBeenCalledWith({
                where: { id: 'mov-1', is_deleted: false },
            });
        });

        it('o extrato vem do mais recente para o mais antigo', async () => {
            await repository.listMovements('wallet-1', 25);

            const args = database.transaction.findMany.mock.calls[0]?.[0] as {
                orderBy?: unknown;
                take?: number;
            };

            expect(args.orderBy).toEqual({ created_at: 'desc' });
            expect(args.take).toBe(25);
        });

        it('sem filtro de estado, não filtra por estado nenhum', async () => {
            await repository.listMovements('wallet-1', 25);

            const where = (database.transaction.findMany.mock.calls[0]?.[0] as {
                where: Record<string, unknown>;
            }).where;

            expect(where).not.toHaveProperty('status');
        });
    });

    describe('reconciliação', () => {
        /**
         * As entradas somam e as saídas subtraem. Trocar os sinais aqui
         * faria a reconciliação confirmar exatamente o saldo errado.
         */
        it('soma as entradas e subtrai as saídas dos movimentos aprovados', async () => {
            database.transaction.groupBy.mockResolvedValue([
                { direction: 'credit', _sum: { amount: 10_000n } },
                { direction: 'debit', _sum: { amount: 4_000n } },
            ]);

            await expect(
                repository.recomputeSettledBalance('wallet-1'),
            ).resolves.toBe(6_000n);
        });

        it('só conta os aprovados', async () => {
            await repository.recomputeSettledBalance('wallet-1');

            expect(database.transaction.groupBy).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ status: 'approved' }),
                }),
            );
        });

        it('uma carteira sem movimentos reconcilia a zero', async () => {
            await expect(
                repository.recomputeSettledBalance('wallet-1'),
            ).resolves.toBe(0n);
        });
    });

    describe('aprovar dentro de uma transação', () => {
        const debito = {
            movementId: 'mov-1',
            walletId: 'wallet-1',
            amount: 4_000n,
            direction: 'debit' as const,
            approvedBy: 'leader-1',
        };

        const credito = { ...debito, direction: 'credit' as const };

        /**
         * A escrita é condicional ao estado pendente. É isto que impede
         * duas aprovações simultâneas do mesmo movimento: só uma altera
         * linha, a outra encontra zero e desiste. Sem a condição, ambas
         * passavam e o dinheiro mexia-se duas vezes.
         */
        it('reclama o movimento só se ainda estiver pendente', async () => {
            const tx = withTransaction();

            await repository.approveMovement(debito);

            const args = tx.transaction.updateMany.mock.calls[0]?.[0] as {
                where: Record<string, unknown>;
            };

            expect(args.where).toEqual({ id: 'mov-1', status: 'pending' });
        });

        it('desiste sem tocar no saldo quando já não está pendente', async () => {
            const tx = withTransaction();
            tx.transaction.updateMany.mockResolvedValue({ count: 0 });

            await expect(repository.approveMovement(debito)).resolves.toEqual({
                outcome: 'not_pending',
            });

            expect(tx.wallet.update).not.toHaveBeenCalled();
            expect(tx.wallet.updateMany).not.toHaveBeenCalled();
        });

        /**
         * A saída é condicional ao saldo chegar. É isto que impede duas
         * saídas diferentes de levarem o mesmo dinheiro: a segunda não
         * encontra saldo e a transação inteira é desfeita.
         */
        it('a saída exige que o saldo chegue', async () => {
            const tx = withTransaction();

            await repository.approveMovement(debito);

            const args = tx.wallet.updateMany.mock.calls[0]?.[0] as {
                where: Record<string, unknown>;
                data: Record<string, unknown>;
            };

            expect(args.where).toEqual({
                id: 'wallet-1',
                balance: { gte: 4_000n },
            });
            expect(args.data['balance']).toEqual({ decrement: 4_000n });
        });

        it('desfaz tudo quando o saldo não chega', async () => {
            const tx = withTransaction();
            tx.wallet.updateMany.mockResolvedValue({ count: 0 });

            await expect(repository.approveMovement(debito)).rejects.toBeInstanceOf(
                InsufficientFundsSignal,
            );
        });

        /**
         * Uma entrada não pode ser condicional ao saldo: receber dinheiro
         * nunca deixa a tesouraria a descoberto.
         */
        it('a entrada soma sem condição de saldo', async () => {
            const tx = withTransaction();

            await repository.approveMovement(credito);

            expect(tx.wallet.updateMany).not.toHaveBeenCalled();

            const args = tx.wallet.update.mock.calls[0]?.[0] as {
                data: Record<string, unknown>;
            };

            expect(args.data['balance']).toEqual({ increment: 4_000n });
        });

        it('regista quem aprovou e quando', async () => {
            const tx = withTransaction();

            await repository.approveMovement(debito);

            const args = tx.transaction.updateMany.mock.calls[0]?.[0] as {
                data: Record<string, unknown>;
            };

            expect(args.data['status']).toBe('approved');
            expect(args.data['decided_by']).toBe('leader-1');
            expect(args.data['decided_at']).toBeInstanceOf(Date);
        });
    });
});
