import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    AuthorizationRepository,
    esquecerCatalogoDeCargos,
} from '../../src/modules/authorization/repositories/authorization.repository.js';
import type { DatabaseClient } from '@vicehub/database';

/**
 * Testes à forma da consulta de permissões.
 *
 * É aqui que se decide o que conta e o que não conta para autorizar um
 * pedido. Um filtro que desaparecesse concederia acesso a mais gente do
 * que devia, sem que nenhum outro teste desse por isso.
 *
 * A leitura está em duas metades, e as regras também. O que muda a toda
 * a hora — que cargos esta pessoa tem, e onde — lê-se em cada pedido, e
 * é aí que vivem o âmbito, as atribuições apagadas e as expiradas. O
 * que muda com um deploy — que permissões dá cada cargo — vem do
 * catálogo, e é lá que vivem os cargos, ligações e permissões
 * apagados.
 */
describe('AuthorizationRepository', () => {
    let database: {
        userRole: { findMany: ReturnType<typeof vi.fn> };
        role: { findMany: ReturnType<typeof vi.fn> };
    };
    let repository: AuthorizationRepository;

    beforeEach(() => {
        esquecerCatalogoDeCargos();

        database = {
            userRole: { findMany: vi.fn().mockResolvedValue([]) },
            role: { findMany: vi.fn().mockResolvedValue([]) },
        };

        repository = new AuthorizationRepository(
            database as unknown as DatabaseClient,
        );
    });

    const whereOf = (): Record<string, unknown> => {
        const args = (database.userRole.findMany.mock.calls[0]?.[0] ?? {}) as {
            where?: Record<string, unknown>;
        };

        return args.where ?? {};
    };

    const scopeConditions = (): unknown[] => (whereOf()['OR'] ?? []) as unknown[];

    describe('âmbito', () => {
        it('sem âmbito, só conta cargos globais', () => {
            repository.findGrantedRoleIds('user-1', {});

            expect(scopeConditions()).toEqual([{ crewId: null, serverId: null }]);
        });

        it('com uma crew, conta os globais e os dessa crew', () => {
            repository.findGrantedRoleIds('user-1', { crewId: 'crew-1' });

            expect(scopeConditions()).toEqual([
                { crewId: null, serverId: null },
                { crewId: 'crew-1', serverId: null },
            ]);
        });

        it('com um servidor, conta os globais e os desse servidor', () => {
            repository.findGrantedRoleIds('user-1', { serverId: 'server-1' });

            expect(scopeConditions()).toEqual([
                { crewId: null, serverId: null },
                { crewId: null, serverId: 'server-1' },
            ]);
        });

        it('um cargo de outra crew nunca é considerado', () => {
            repository.findGrantedRoleIds('user-1', { crewId: 'crew-1' });

            /**
             * As condições nomeiam sempre a crew pedida. Não existe
             * nenhuma que aceite qualquer crew.
             */
            const conditions = scopeConditions() as { crewId: string | null }[];

            expect(
                conditions.every(
                    (condition) =>
                        condition.crewId === null || condition.crewId === 'crew-1',
                ),
            ).toBe(true);
        });
    });

    describe('o que se lê em cada pedido', () => {
        it('procura apenas os cargos do utilizador indicado', () => {
            repository.findGrantedRoleIds('user-1', {});

            expect(whereOf()['userId']).toBe('user-1');
        });

        it('ignora atribuições eliminadas', () => {
            repository.findGrantedRoleIds('user-1', {});

            expect(whereOf()['is_deleted']).toBe(false);
        });

        it('ignora atribuições expiradas', () => {
            repository.findGrantedRoleIds('user-1', {});

            expect(whereOf()['AND']).toEqual([
                { OR: [{ expires_at: null }, { expires_at: { gt: expect.any(Date) } }] },
            ]);
        });

        /**
         * **E não traz mais nada.**
         *
         * É a razão de esta leitura existir separada: corre em cada
         * pedido autenticado, e a casca faz três por página. Pedir o
         * cargo e as permissões dele fazia o Prisma partir a leitura em
         * quatro instruções, e a página pagava-as todas, três vezes.
         */
        it('e traz só o identificador do cargo', () => {
            repository.findGrantedRoleIds('user-1', {});

            const args = database.userRole.findMany.mock.calls[0]?.[0] as {
                select: Record<string, unknown>;
            };

            expect(args.select).toEqual({ roleId: true });
        });
    });

    describe('o catálogo dos cargos', () => {
        it('ignora cargos eliminados', async () => {
            await repository.permissionsByRole();

            const args = database.role.findMany.mock.calls[0]?.[0] as {
                where: Record<string, unknown>;
            };

            expect(args.where).toEqual({ is_deleted: false });
        });

        it('ignora permissões e ligações eliminadas', async () => {
            await repository.permissionsByRole();

            const args = database.role.findMany.mock.calls[0]?.[0] as {
                select: {
                    rolePermissions: { where: Record<string, unknown> };
                };
            };

            expect(args.select.rolePermissions.where).toEqual({
                is_deleted: false,
                permission: { is_deleted: false },
            });
        });

        it('traz as permissões de cada cargo, pela chave do guard', async () => {
            database.role.findMany.mockResolvedValue([
                {
                    id: 'cargo-1',
                    rolePermissions: [
                        { permission: { scope: 'crew', slug: 'manage' } },
                        { permission: { scope: 'treasury', slug: 'approve' } },
                    ],
                },
            ]);

            const catalogo = await repository.permissionsByRole();

            expect([...(catalogo.get('cargo-1') ?? [])]).toEqual([
                'crew:manage',
                'treasury:approve',
            ]);
        });

        /**
         * **Lê-se uma vez, e não em cada pedido.** É a metade que faz a
         * conta valer a pena: sem isto, separar as duas leituras só
         * acrescentava uma consulta.
         */
        it('não volta à base de dados no pedido seguinte', async () => {
            await repository.permissionsByRole();
            await repository.permissionsByRole();
            await repository.permissionsByRole();

            expect(database.role.findMany).toHaveBeenCalledTimes(1);
        });

        /**
         * Mas volta quando lhe pedem um cargo que não conhece. Um cargo
         * criado depois de o processo arrancar não pode ficar sem
         * permissões até alguém reiniciar.
         */
        it('e volta quando lhe pedem um cargo que não conhece', async () => {
            await repository.permissionsByRole();
            await repository.permissionsByRole(['cargo-1']);

            expect(database.role.findMany).toHaveBeenCalledTimes(2);
        });

        /**
         * E o cargo novo vale logo no pedido seguinte.
         *
         * É a razão de a releitura existir, e não um detalhe: um cargo
         * criado com a aplicação de pé — um cargo de moderação dado a
         * alguém, por exemplo — não pode autorizar coisa nenhuma até
         * alguém reiniciar o processo.
         */
        it('e o cargo novo concede logo o que tem', async () => {
            await repository.permissionsByRole();

            database.role.findMany.mockResolvedValue([
                {
                    id: 'cargo-novo',
                    rolePermissions: [
                        { permission: { scope: 'market', slug: 'moderate' } },
                    ],
                },
            ]);

            const catalogo = await repository.permissionsByRole(['cargo-novo']);

            expect([...(catalogo.get('cargo-novo') ?? [])]).toEqual([
                'market:moderate',
            ]);
        });

        it('e não volta quando conhece todos os que lhe pedem', async () => {
            database.role.findMany.mockResolvedValue([
                { id: 'cargo-1', rolePermissions: [] },
            ]);

            await repository.permissionsByRole(['cargo-1']);
            await repository.permissionsByRole(['cargo-1']);

            expect(database.role.findMany).toHaveBeenCalledTimes(1);
        });

        /**
         * E um cargo que **nunca** vai existir não relê o catálogo a
         * cada pedido.
         *
         * Um cargo apagado sai do catálogo, mas as atribuições dele
         * ficam: quem o tivesse traria um identificador desconhecido em
         * todos os pedidos. Sem travão, essa pessoa sozinha punha a
         * aplicação a reler o catálogo mais vezes do que a leitura que
         * ele veio poupar.
         */
        it('e um cargo que não existe não o faz reler a cada pedido', async () => {
            await repository.permissionsByRole();

            /*
             * A primeira vez procura-o — podia ser novo. Depois de uma
             * leitura fresca não o encontrar, não é novo: não existe.
             */
            await repository.permissionsByRole(['fantasma']);
            await repository.permissionsByRole(['fantasma']);
            await repository.permissionsByRole(['fantasma']);

            expect(database.role.findMany).toHaveBeenCalledTimes(2);
        });

        /**
         * E envelhece. O catálogo é um espelho do que o `db:seed`
         * grava, e um deploy reinicia o processo — mas quem mexer nas
         * linhas com a aplicação de pé não devia esperar para sempre.
         */
        it('e envelhece ao fim de um minuto', async () => {
            vi.useFakeTimers();

            try {
                await repository.permissionsByRole();

                vi.advanceTimersByTime(61_000);

                await repository.permissionsByRole();

                expect(database.role.findMany).toHaveBeenCalledTimes(2);
            } finally {
                vi.useRealTimers();
            }
        });
    });
});
