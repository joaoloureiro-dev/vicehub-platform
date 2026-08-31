import { ROLES } from '@vicehub/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorizationError } from '../../src/modules/authorization/errors/authorization.errors.js';
import { RoleAssignmentService } from '../../src/modules/authorization/services/role-assignment.service.js';
import type { RoleAssignmentRepository } from '../../src/modules/authorization/repositories/role-assignment.repository.js';

const createRepositoryMock = () => ({
    findRoleIdBySlug: vi.fn().mockResolvedValue({ id: 'role-1' }),
    replaceScopedRole: vi.fn().mockResolvedValue(undefined),
    revokeRolesInScope: vi.fn().mockResolvedValue(undefined),
    countHoldersOfRole: vi.fn().mockResolvedValue(1),
    findScopedRoleIds: vi.fn().mockResolvedValue([]),
});

describe('RoleAssignmentService', () => {
    let repository: ReturnType<typeof createRepositoryMock>;
    let service: RoleAssignmentService;

    const escopo = { crewId: 'crew-1' };

    beforeEach(() => {
        repository = createRepositoryMock();
        service = new RoleAssignmentService(
            repository as unknown as RoleAssignmentRepository,
        );
    });

    describe('atribuição', () => {
        it('procura o cargo pelo slug e escopo do catálogo', async () => {
            await service.setScopedRole('user-1', 'crew_leader', escopo);

            expect(repository.findRoleIdBySlug).toHaveBeenCalledWith(
                ROLES.crew_leader.slug,
                ROLES.crew_leader.scope,
            );
        });

        it('substitui os cargos anteriores no mesmo âmbito', async () => {
            repository.findScopedRoleIds.mockResolvedValue([
                { roleId: 'role-antigo', role: { slug: 'crew_member' } },
            ]);

            await service.setScopedRole('user-1', 'crew_officer', escopo);

            /**
             * Sem substituir, o utilizador acumularia cargos e passaria a
             * ter a soma dos poderes de todos eles.
             */
            expect(repository.replaceScopedRole).toHaveBeenCalledWith({
                userId: 'user-1',
                roleId: 'role-1',
                scope: escopo,
                currentRoleIds: ['role-antigo'],
            });
        });

        it('falha de forma clara se o cargo não existir na base de dados', async () => {
            repository.findRoleIdBySlug.mockResolvedValue(null);

            await expect(
                service.setScopedRole('user-1', 'crew_leader', escopo),
            ).rejects.toThrow(/db:seed/);

            expect(repository.replaceScopedRole).not.toHaveBeenCalled();
        });
    });

    describe('revogação', () => {
        it('retira todos os cargos do âmbito indicado', async () => {
            await service.revokeScopedRoles('user-1', escopo);

            expect(repository.revokeRolesInScope).toHaveBeenCalledWith('user-1', escopo);
        });
    });

    describe('cargo em vigor', () => {
        it('devolve o slug quando existe', async () => {
            repository.findScopedRoleIds.mockResolvedValue([
                { roleId: 'r1', role: { slug: 'crew_officer' } },
            ]);

            await expect(service.getScopedRoleSlug('user-1', escopo)).resolves.toBe(
                'crew_officer',
            );
        });

        it('devolve null quando não tem nenhum', async () => {
            await expect(service.getScopedRoleSlug('user-1', escopo)).resolves.toBeNull();
        });
    });

    describe('proteção do último detentor', () => {
        const comoLider = () => {
            repository.findScopedRoleIds.mockResolvedValue([
                { roleId: 'role-1', role: { slug: ROLES.crew_leader.slug } },
            ]);
        };

        it('recusa quando é o único líder', async () => {
            comoLider();
            repository.countHoldersOfRole.mockResolvedValue(1);

            const error = await service
                .assertNotLastHolder('user-1', 'crew_leader', escopo)
                .catch((caught: unknown) => caught);

            expect(error).toBeInstanceOf(AuthorizationError);
            expect((error as AuthorizationError).code).toBe('LAST_ROLE_HOLDER');
        });

        it('deixa passar quando há outro líder', async () => {
            comoLider();
            repository.countHoldersOfRole.mockResolvedValue(2);

            await expect(
                service.assertNotLastHolder('user-1', 'crew_leader', escopo),
            ).resolves.toBeUndefined();
        });

        it('não se aplica a quem não é líder', async () => {
            repository.findScopedRoleIds.mockResolvedValue([
                { roleId: 'r1', role: { slug: ROLES.crew_member.slug } },
            ]);

            await expect(
                service.assertNotLastHolder('user-1', 'crew_leader', escopo),
            ).resolves.toBeUndefined();

            /**
             * Sair sendo membro não tem de contar líderes.
             */
            expect(repository.countHoldersOfRole).not.toHaveBeenCalled();
        });

        it('não se aplica a quem não tem cargo nenhum', async () => {
            await expect(
                service.assertNotLastHolder('user-1', 'crew_leader', escopo),
            ).resolves.toBeUndefined();
        });
    });
});
