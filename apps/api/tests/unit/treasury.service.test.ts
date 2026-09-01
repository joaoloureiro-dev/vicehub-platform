import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TreasuryError } from '../../src/modules/treasury/errors/treasury.errors.js';
import { InsufficientFundsSignal } from '../../src/modules/treasury/repositories/treasury.repository.js';
import { TreasuryService } from '../../src/modules/treasury/services/treasury.service.js';
import type { TreasuryRepository } from '../../src/modules/treasury/repositories/treasury.repository.js';

const wallet = (balance: bigint) => ({ id: 'wallet-1', balance });

const createRepositoryMock = () => ({
    findWalletByOwner: vi.fn().mockResolvedValue(wallet(0n)),
    createWalletForOwner: vi.fn().mockResolvedValue(wallet(0n)),
    sumByDirection: vi.fn().mockResolvedValue([]),
    listMovements: vi.fn().mockResolvedValue([]),
    recomputeSettledBalance: vi.fn().mockResolvedValue(0n),
    findMovementById: vi.fn(),
    createMovement: vi.fn().mockResolvedValue({ id: 'mov-1' }),
    approveMovement: vi.fn().mockResolvedValue({ outcome: 'approved' }),
    closeMovement: vi.fn().mockResolvedValue({ count: 1 }),
    listActiveMemberIds: vi.fn().mockResolvedValue(['user-1', 'user-2', 'user-3']),
    ensureWalletsForUsers: vi.fn().mockImplementation((userIds: string[]) =>
        Promise.resolve(new Map(userIds.map((id) => [id, `wallet-de-${id}`]))),
    ),
    createDistribution: vi.fn().mockResolvedValue({ id: 'dist-1' }),
    findDistributionById: vi.fn(),
    listDistributions: vi.fn().mockResolvedValue([]),
    approveDistribution: vi.fn().mockResolvedValue({ outcome: 'approved' }),
    closeDistribution: vi.fn().mockResolvedValue({ count: 1 }),
});

const pendingDistribution = (overrides: Record<string, unknown> = {}) => ({
    id: 'dist-1',
    walletId: 'wallet-1',
    total: 900n,
    status: 'pending',
    lines: [
        { walletId: 'wallet-1', amount: 900n, direction: 'debit' },
        { walletId: 'wallet-de-user-1', amount: 300n, direction: 'credit' },
        { walletId: 'wallet-de-user-2', amount: 300n, direction: 'credit' },
        { walletId: 'wallet-de-user-3', amount: 300n, direction: 'credit' },
    ],
    ...overrides,
});

const pendingMovement = (overrides: Record<string, unknown> = {}) => ({
    id: 'mov-1',
    walletId: 'wallet-1',
    amount: 500n,
    direction: 'debit',
    status: 'pending',
    requested_by: 'officer-1',
    ...overrides,
});

describe('TreasuryService', () => {
    let repository: ReturnType<typeof createRepositoryMock>;
    let service: TreasuryService;

    beforeEach(() => {
        repository = createRepositoryMock();
        service = new TreasuryService(
            repository as unknown as TreasuryRepository,
        );
    });

    describe('os três saldos', () => {
        it('sem movimentos pendentes, o disponível é o liquidado', async () => {
            repository.findWalletByOwner.mockResolvedValue(wallet(5_000n));

            await expect(service.getBalances({ crewId: 'crew-1' })).resolves.toEqual({
                settled: 5_000n,
                pendingIn: 0n,
                pendingOut: 0n,
                available: 5_000n,
            });
        });

        /**
         * Sem descontar as saídas propostas, duas despesas aprovadas em
         * separado caberiam ambas no saldo liquidado e nenhuma no que
         * resta: o mesmo dinheiro comprometido duas vezes.
         */
        it('as saídas pendentes descontam do disponível', async () => {
            repository.findWalletByOwner.mockResolvedValue(wallet(5_000n));
            repository.sumByDirection.mockResolvedValue([
                { direction: 'debit', _sum: { amount: 1_200n } },
            ]);

            const saldos = await service.getBalances({ crewId: 'crew-1' });

            expect(saldos.pendingOut).toBe(1_200n);
            expect(saldos.available).toBe(3_800n);
            expect(saldos.settled).toBe(5_000n);
        });

        /**
         * Uma entrada proposta ainda não entrou. Somá-la ao disponível
         * deixaria gastar dinheiro que pode nunca chegar.
         */
        it('as entradas pendentes não aumentam o disponível', async () => {
            repository.findWalletByOwner.mockResolvedValue(wallet(1_000n));
            repository.sumByDirection.mockResolvedValue([
                { direction: 'credit', _sum: { amount: 9_000n } },
            ]);

            const saldos = await service.getBalances({ crewId: 'crew-1' });

            expect(saldos.pendingIn).toBe(9_000n);
            expect(saldos.available).toBe(1_000n);
        });

        it('conta entradas e saídas pendentes em separado', async () => {
            repository.findWalletByOwner.mockResolvedValue(wallet(2_000n));
            repository.sumByDirection.mockResolvedValue([
                { direction: 'credit', _sum: { amount: 700n } },
                { direction: 'debit', _sum: { amount: 500n } },
            ]);

            const saldos = await service.getBalances({ crewId: 'crew-1' });

            expect(saldos).toEqual({
                settled: 2_000n,
                pendingIn: 700n,
                pendingOut: 500n,
                available: 1_500n,
            });
        });

        it('o disponível pode ficar negativo quando há mais saídas do que saldo', async () => {
            repository.findWalletByOwner.mockResolvedValue(wallet(100n));
            repository.sumByDirection.mockResolvedValue([
                { direction: 'debit', _sum: { amount: 400n } },
            ]);

            const saldos = await service.getBalances({ crewId: 'crew-1' });

            /**
             * Mostrar o descoberto é o ponto: é o sinal de que há mais
             * despesa proposta do que dinheiro para a cobrir.
             */
            expect(saldos.available).toBe(-300n);
        });

        it('só lê os pendentes, não os aprovados', async () => {
            await service.getBalances({ crewId: 'crew-1' });

            expect(repository.sumByDirection).toHaveBeenCalledWith(
                'wallet-1',
                'pending',
            );
        });
    });

    describe('titular da carteira', () => {
        it.each([
            ['user', { userId: 'owner-1' }],
            ['crew', { crewId: 'owner-1' }],
            ['server', { serverId: 'owner-1' }],
        ] as const)('%s vai para o campo que lhe corresponde', (kind, esperado) => {
            expect(service.buildOwner(kind, 'owner-1')).toEqual(esperado);
        });

        const expectTreasuryError = async (
            promise: Promise<unknown>,
            code: string,
        ) => {
            const error = await promise.catch((caught: unknown) => caught);

            expect(error).toBeInstanceOf(TreasuryError);
            expect((error as TreasuryError).code).toBe(code);
        };

        it('recusa um titular com dois campos preenchidos', async () => {
            await expectTreasuryError(
                service.getBalances({ userId: 'u-1', crewId: 'c-1' }),
                'INVALID_WALLET_OWNER',
            );
        });

        it('recusa um titular sem campo nenhum', async () => {
            await expectTreasuryError(service.getBalances({}), 'INVALID_WALLET_OWNER');
        });
    });

    describe('carteira em falta', () => {
        /**
         * As carteiras passaram a nascer com a entidade, mas as contas
         * criadas antes disso não têm nenhuma. A tesouraria não pode
         * rebentar para elas.
         */
        it('cria a carteira quando o titular ainda não tem', async () => {
            repository.findWalletByOwner.mockResolvedValue(null);
            repository.createWalletForOwner.mockResolvedValue(wallet(0n));

            const saldos = await service.getBalances({ userId: 'user-1' });

            expect(repository.createWalletForOwner).toHaveBeenCalledWith({
                userId: 'user-1',
            });
            expect(saldos.settled).toBe(0n);
        });

        it('não cria carteira nenhuma quando já existe', async () => {
            await service.getBalances({ crewId: 'crew-1' });

            expect(repository.createWalletForOwner).not.toHaveBeenCalled();
        });
    });

    describe('reconciliação do saldo', () => {
        /**
         * O saldo guardado é uma cache mantida por quem aprova. Uma cache
         * que ninguém verifica acaba por divergir sem ninguém dar por isso.
         */
        it('confirma quando o guardado bate certo com os movimentos', async () => {
            repository.findWalletByOwner.mockResolvedValue(wallet(3_000n));
            repository.recomputeSettledBalance.mockResolvedValue(3_000n);

            await expect(service.reconcile({ crewId: 'crew-1' })).resolves.toEqual({
                stored: 3_000n,
                recomputed: 3_000n,
                matches: true,
            });
        });

        it('denuncia a divergência quando não bate', async () => {
            repository.findWalletByOwner.mockResolvedValue(wallet(3_000n));
            repository.recomputeSettledBalance.mockResolvedValue(2_500n);

            const resultado = await service.reconcile({ crewId: 'crew-1' });

            expect(resultado.matches).toBe(false);
            expect(resultado.stored).toBe(3_000n);
            expect(resultado.recomputed).toBe(2_500n);
        });
    });

    describe('extrato', () => {
        it('passa adiante o limite e o filtro de estado', async () => {
            await service.listMovements({ crewId: 'crew-1' }, 10, 'approved');

            expect(repository.listMovements).toHaveBeenCalledWith(
                'wallet-1',
                10,
                'approved',
            );
        });

        it('traduz cada movimento para a forma da resposta', async () => {
            repository.listMovements.mockResolvedValue([
                {
                    id: 'tx-1',
                    amount: 2_500n,
                    direction: 'debit',
                    category: 'server_costs',
                    status: 'approved',
                    description: 'Servidor de outubro',
                    requested_by: 'user-2',
                    decided_by: 'user-1',
                    decided_at: new Date('2026-03-02T00:00:00.000Z'),
                    created_at: new Date('2026-03-01T00:00:00.000Z'),
                },
            ]);

            const [movimento] = await service.listMovements({ crewId: 'crew-1' }, 25);

            expect(movimento).toEqual({
                id: 'tx-1',
                amount: 2_500n,
                direction: 'debit',
                category: 'server_costs',
                status: 'approved',
                description: 'Servidor de outubro',
                requestedBy: 'user-2',
                decidedBy: 'user-1',
                decidedAt: new Date('2026-03-02T00:00:00.000Z'),
                createdAt: new Date('2026-03-01T00:00:00.000Z'),
            });
        });
    });

    const expectTreasuryError = async (promise: Promise<unknown>, code: string) => {
        const error = await promise.catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(TreasuryError);
        expect((error as TreasuryError).code).toBe(code);
    };

    describe('propor um movimento', () => {
        it('nasce pendente na carteira do titular', async () => {
            await service.proposeMovement(
                { crewId: 'crew-1' },
                {
                    amount: 1_500n,
                    direction: 'debit',
                    category: 'server_costs',
                    description: 'Servidor de outubro',
                    requestedBy: 'officer-1',
                },
            );

            expect(repository.createMovement).toHaveBeenCalledWith({
                walletId: 'wallet-1',
                amount: 1_500n,
                direction: 'debit',
                category: 'server_costs',
                description: 'Servidor de outubro',
                requestedBy: 'officer-1',
            });
        });

        /**
         * Propor não é mover. Se propor mexesse no saldo, a aprovação
         * chegaria tarde de mais para servir de alguma coisa.
         */
        it('propor não mexe no saldo', async () => {
            await service.proposeMovement(
                { crewId: 'crew-1' },
                {
                    amount: 1_500n,
                    direction: 'debit',
                    category: 'other',
                    description: 'seja o que for',
                    requestedBy: 'officer-1',
                },
            );

            expect(repository.approveMovement).not.toHaveBeenCalled();
        });
    });

    describe('confusão de âmbito', () => {
        /**
         * O guard de permissões só olha para o parâmetro da rota. Se o
         * serviço não confirmasse que o movimento pertence a esta
         * tesouraria, quem manda na crew A aprovaria movimentos da crew B
         * pondo o identificador da sua no caminho.
         */
        it('recusa decidir um movimento de outra tesouraria', async () => {
            repository.findWalletByOwner.mockResolvedValue(wallet(0n));
            repository.findMovementById.mockResolvedValue(
                pendingMovement({ walletId: 'wallet-de-outra-crew' }),
            );

            await expectTreasuryError(
                service.approveMovement({ crewId: 'crew-1' }, 'mov-1', 'leader-1'),
                'MOVEMENT_NOT_FOUND',
            );

            expect(repository.approveMovement).not.toHaveBeenCalled();
        });

        it('recusa um movimento que não existe', async () => {
            repository.findMovementById.mockResolvedValue(null);

            await expectTreasuryError(
                service.approveMovement({ crewId: 'crew-1' }, 'mov-1', 'leader-1'),
                'MOVEMENT_NOT_FOUND',
            );
        });
    });

    describe('aprovar', () => {
        beforeEach(() => {
            repository.findMovementById.mockResolvedValue(pendingMovement());
        });

        it('move o dinheiro com o sentido e o montante do movimento', async () => {
            await service.approveMovement({ crewId: 'crew-1' }, 'mov-1', 'leader-1');

            expect(repository.approveMovement).toHaveBeenCalledWith({
                movementId: 'mov-1',
                walletId: 'wallet-1',
                amount: 500n,
                direction: 'debit',
                approvedBy: 'leader-1',
            });
        });

        /**
         * Duas aprovações simultâneas do mesmo movimento: a segunda
         * encontra-o já decidido e não pode fazer o dinheiro sair outra
         * vez.
         */
        it('recusa quando outra aprovação chegou primeiro', async () => {
            repository.approveMovement.mockResolvedValue({ outcome: 'not_pending' });

            await expectTreasuryError(
                service.approveMovement({ crewId: 'crew-1' }, 'mov-1', 'leader-1'),
                'MOVEMENT_NOT_PENDING',
            );
        });

        it('recusa quando a tesouraria não tem saldo', async () => {
            repository.approveMovement.mockRejectedValue(new InsufficientFundsSignal());

            await expectTreasuryError(
                service.approveMovement({ crewId: 'crew-1' }, 'mov-1', 'leader-1'),
                'INSUFFICIENT_FUNDS',
            );
        });

        it('não engole erros que não sejam falta de saldo', async () => {
            repository.approveMovement.mockRejectedValue(new Error('a base caiu'));

            const error = await service
                .approveMovement({ crewId: 'crew-1' }, 'mov-1', 'leader-1')
                .catch((caught: unknown) => caught);

            expect(error).toBeInstanceOf(Error);
            expect(error).not.toBeInstanceOf(TreasuryError);
        });

        it('recusa aprovar um movimento já decidido', async () => {
            repository.findMovementById.mockResolvedValue(
                pendingMovement({ status: 'approved' }),
            );

            await expectTreasuryError(
                service.approveMovement({ crewId: 'crew-1' }, 'mov-1', 'leader-1'),
                'MOVEMENT_NOT_PENDING',
            );

            expect(repository.approveMovement).not.toHaveBeenCalled();
        });
    });

    describe('recusar', () => {
        beforeEach(() => {
            repository.findMovementById.mockResolvedValue(pendingMovement());
        });

        it('encerra o movimento sem mexer no saldo', async () => {
            await service.rejectMovement({ crewId: 'crew-1' }, 'mov-1', 'leader-1');

            expect(repository.closeMovement).toHaveBeenCalledWith({
                movementId: 'mov-1',
                status: 'rejected',
                decidedBy: 'leader-1',
            });
            expect(repository.approveMovement).not.toHaveBeenCalled();
        });

        it('recusa quando o movimento deixou de estar pendente entretanto', async () => {
            repository.closeMovement.mockResolvedValue({ count: 0 });

            await expectTreasuryError(
                service.rejectMovement({ crewId: 'crew-1' }, 'mov-1', 'leader-1'),
                'MOVEMENT_NOT_PENDING',
            );
        });
    });

    describe('retirar a própria proposta', () => {
        beforeEach(() => {
            repository.findMovementById.mockResolvedValue(pendingMovement());
        });

        it('quem propôs pode retirar', async () => {
            await service.cancelMovement({ crewId: 'crew-1' }, 'mov-1', 'officer-1');

            expect(repository.closeMovement).toHaveBeenCalledWith({
                movementId: 'mov-1',
                status: 'canceled',
                decidedBy: 'officer-1',
            });
        });

        /**
         * Cancelar a proposta de outra pessoa é uma decisão, e decisões
         * passam por recusar — que fica registada com quem a tomou.
         * Deixar cancelar seria uma forma de travar despesas sem deixar
         * rasto de quem as travou.
         */
        it('mais ninguém pode retirar a proposta de outro', async () => {
            await expectTreasuryError(
                service.cancelMovement({ crewId: 'crew-1' }, 'mov-1', 'leader-1'),
                'NOT_THE_PROPOSER',
            );

            expect(repository.closeMovement).not.toHaveBeenCalled();
        });
    });

    describe('propor uma divisão', () => {
        const emPartesIguais = {
            basis: 'equal' as const,
            total: 900n,
            requestedBy: 'leader-1',
        };

        it('divide pelos membros ativos lidos do lado do servidor', async () => {
            await service.proposeDistribution({ crewId: 'crew-1' }, emPartesIguais);

            expect(repository.listActiveMemberIds).toHaveBeenCalledWith({
                crewId: 'crew-1',
            });

            const criada = repository.createDistribution.mock.calls[0]?.[0] as {
                shares: { walletId: string; amount: bigint }[];
                total: bigint;
            };

            expect(criada.total).toBe(900n);
            expect(criada.shares).toEqual([
                { walletId: 'wallet-de-user-1', amount: 300n },
                { walletId: 'wallet-de-user-2', amount: 300n },
                { walletId: 'wallet-de-user-3', amount: 300n },
            ]);
        });

        /**
         * Quem propõe não escolhe a quem paga: a lista de membros é lida
         * da base de dados, não do pedido.
         */
        it('uma crew sem membros ativos não pode distribuir', async () => {
            repository.listActiveMemberIds.mockResolvedValue([]);

            await expectTreasuryError(
                service.proposeDistribution({ crewId: 'crew-1' }, emPartesIguais),
                'NO_MEMBERS_TO_PAY',
            );

            expect(repository.createDistribution).not.toHaveBeenCalled();
        });

        it('propor não move dinheiro nenhum', async () => {
            await service.proposeDistribution({ crewId: 'crew-1' }, emPartesIguais);

            expect(repository.approveDistribution).not.toHaveBeenCalled();
        });

        it('garante carteira a todos os que recebem', async () => {
            await service.proposeDistribution({ crewId: 'crew-1' }, emPartesIguais);

            expect(repository.ensureWalletsForUsers).toHaveBeenCalledWith([
                'user-1',
                'user-2',
                'user-3',
            ]);
        });

        /**
         * Numa divisão manual o total é o que as partes somam. Aceitar um
         * total enviado à parte abriria a porta a uma divisão que diz
         * tirar 1000 da tesouraria e só distribui 900.
         */
        it('numa divisão manual o total é a soma das partes, e não um valor enviado', async () => {
            await service.proposeDistribution(
                { crewId: 'crew-1' },
                {
                    basis: 'manual',
                    total: 5_000n,
                    shares: [
                        { userId: 'user-1', amount: 600n },
                        { userId: 'user-2', amount: 300n },
                    ],
                    requestedBy: 'leader-1',
                },
            );

            const criada = repository.createDistribution.mock.calls[0]?.[0] as {
                total: bigint;
            };

            expect(criada.total).toBe(900n);
        });

        it('não grava partes de valor zero', async () => {
            repository.listActiveMemberIds.mockResolvedValue([
                'user-1',
                'user-2',
                'user-3',
            ]);

            await service.proposeDistribution(
                { crewId: 'crew-1' },
                { basis: 'equal', total: 2n, requestedBy: 'leader-1' },
            );

            const criada = repository.createDistribution.mock.calls[0]?.[0] as {
                shares: { amount: bigint }[];
            };

            expect(criada.shares).toHaveLength(2);
            expect(criada.shares.every((share) => share.amount > 0n)).toBe(true);
        });
    });

    describe('a soma das partes tem de fechar', () => {
        /**
         * Esta verificação não é alcançável pelo uso normal: os dois
         * cálculos fecham por construção. Existe como rede contra um erro
         * futuro no cálculo da divisão, e por isso é forçada aqui — se a
         * calculadora começasse a mentir, a tesouraria ficava com
         * dinheiro a mais ou a menos sem ninguém dar por isso.
         */
        it('recusa gravar quando as partes não somam o total', async () => {
            const partido = new TreasuryService(
                repository as unknown as TreasuryRepository,
            );

            const original = Object.getPrototypeOf(partido) as {
                buildShares: unknown;
            };

            const espia = vi
                .spyOn(
                    original as unknown as {
                        buildShares: (...args: unknown[]) => unknown;
                    },
                    'buildShares',
                )
                .mockReturnValue({
                    total: 900n,
                    shares: [{ userId: 'user-1', amount: 100n }],
                });

            await expectTreasuryError(
                partido.proposeDistribution(
                    { crewId: 'crew-1' },
                    { basis: 'equal', total: 900n, requestedBy: 'leader-1' },
                ),
                'SHARES_DO_NOT_MATCH_TOTAL',
            );

            expect(repository.createDistribution).not.toHaveBeenCalled();

            espia.mockRestore();
        });
    });

    describe('decidir uma divisão', () => {
        beforeEach(() => {
            repository.findDistributionById.mockResolvedValue(pendingDistribution());
        });

        it('aprovar paga apenas as linhas de entrada', async () => {
            await service.approveDistribution(
                { crewId: 'crew-1' },
                'dist-1',
                'leader-1',
            );

            const pedido = repository.approveDistribution.mock.calls[0]?.[0] as {
                credits: { walletId: string; amount: bigint }[];
                total: bigint;
            };

            expect(pedido.total).toBe(900n);
            expect(pedido.credits).toHaveLength(3);
            expect(pedido.credits.every((credit) => credit.amount === 300n)).toBe(true);
        });

        /**
         * A mesma confusão de âmbito dos movimentos: o guard só olha para
         * o parâmetro da rota, por isso é o serviço que tem de confirmar
         * que a divisão é mesmo desta tesouraria.
         */
        it('recusa decidir uma divisão de outra tesouraria', async () => {
            repository.findDistributionById.mockResolvedValue(
                pendingDistribution({ walletId: 'wallet-de-outra-crew' }),
            );

            await expectTreasuryError(
                service.approveDistribution({ crewId: 'crew-1' }, 'dist-1', 'leader-1'),
                'DISTRIBUTION_NOT_FOUND',
            );

            expect(repository.approveDistribution).not.toHaveBeenCalled();
        });

        it('recusa uma divisão que não existe', async () => {
            repository.findDistributionById.mockResolvedValue(null);

            await expectTreasuryError(
                service.approveDistribution({ crewId: 'crew-1' }, 'dist-1', 'leader-1'),
                'DISTRIBUTION_NOT_FOUND',
            );
        });

        it('recusa aprovar uma divisão já decidida', async () => {
            repository.findDistributionById.mockResolvedValue(
                pendingDistribution({ status: 'approved' }),
            );

            await expectTreasuryError(
                service.approveDistribution({ crewId: 'crew-1' }, 'dist-1', 'leader-1'),
                'DISTRIBUTION_NOT_PENDING',
            );
        });

        it('recusa quando outra aprovação chegou primeiro', async () => {
            repository.approveDistribution.mockResolvedValue({
                outcome: 'not_pending',
            });

            await expectTreasuryError(
                service.approveDistribution({ crewId: 'crew-1' }, 'dist-1', 'leader-1'),
                'DISTRIBUTION_NOT_PENDING',
            );
        });

        it('traduz a falta de saldo', async () => {
            repository.approveDistribution.mockRejectedValue(
                new InsufficientFundsSignal(),
            );

            await expectTreasuryError(
                service.approveDistribution({ crewId: 'crew-1' }, 'dist-1', 'leader-1'),
                'INSUFFICIENT_FUNDS',
            );
        });

        it('recusar encerra a divisão e as linhas sem mexer no saldo', async () => {
            await service.rejectDistribution({ crewId: 'crew-1' }, 'dist-1', 'leader-1');

            expect(repository.closeDistribution).toHaveBeenCalledWith({
                distributionId: 'dist-1',
                status: 'rejected',
                lineStatus: 'rejected',
                decidedBy: 'leader-1',
            });
            expect(repository.approveDistribution).not.toHaveBeenCalled();
        });
    });
});
