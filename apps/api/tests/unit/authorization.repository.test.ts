import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorizationRepository } from '../../src/modules/authorization/repositories/authorization.repository.js';
import type { DatabaseClient } from '@vicehub/database';

/**
 * Testes à forma da consulta de permissões.
 *
 * É aqui que se decide o que conta e o que não conta para autorizar um
 * pedido. Um filtro que desaparecesse concederia acesso a mais gente do
 * que devia, sem que nenhum outro teste desse por isso.
 */
describe('AuthorizationRepository', () => {
    let database: { userRole: { findMany: ReturnType<typeof vi.fn> } };
    let repository: AuthorizationRepository;

    beforeEach(() => {
        database = { userRole: { findMany: vi.fn() } };
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
            repository.findGrantedPermissions('user-1', {});

            expect(scopeConditions()).toEqual([{ crewId: null, serverId: null }]);
        });

        it('com uma crew, conta os globais e os dessa crew', () => {
            repository.findGrantedPermissions('user-1', { crewId: 'crew-1' });

            expect(scopeConditions()).toEqual([
                { crewId: null, serverId: null },
                { crewId: 'crew-1', serverId: null },
            ]);
        });

        it('com um servidor, conta os globais e os desse servidor', () => {
            repository.findGrantedPermissions('user-1', { serverId: 'server-1' });

            expect(scopeConditions()).toEqual([
                { crewId: null, serverId: null },
                { crewId: null, serverId: 'server-1' },
            ]);
        });

        it('um cargo de outra crew nunca é considerado', () => {
            repository.findGrantedPermissions('user-1', { crewId: 'crew-1' });

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

    describe('filtros', () => {
        it('procura apenas os cargos do utilizador indicado', () => {
            repository.findGrantedPermissions('user-1', {});

            expect(whereOf()['userId']).toBe('user-1');
        });

        it('ignora atribuições eliminadas', () => {
            repository.findGrantedPermissions('user-1', {});

            expect(whereOf()['is_deleted']).toBe(false);
        });

        it('ignora atribuições expiradas', () => {
            repository.findGrantedPermissions('user-1', {});

            expect(whereOf()['AND']).toEqual([
                { OR: [{ expires_at: null }, { expires_at: { gt: expect.any(Date) } }] },
            ]);
        });

        it('ignora cargos eliminados', () => {
            repository.findGrantedPermissions('user-1', {});

            expect(whereOf()['role']).toEqual({ is_deleted: false });
        });

        it('ignora permissões e ligações eliminadas', () => {
            repository.findGrantedPermissions('user-1', {});

            const args = database.userRole.findMany.mock.calls[0]?.[0] as {
                select: {
                    role: {
                        select: {
                            rolePermissions: { where: Record<string, unknown> };
                        };
                    };
                };
            };

            expect(args.select.role.select.rolePermissions.where).toEqual({
                is_deleted: false,
                permission: { is_deleted: false },
            });
        });
    });
});
