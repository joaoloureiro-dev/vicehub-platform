import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorizationError } from '../../src/modules/authorization/errors/authorization.errors.js';
import { CrewError } from '../../src/modules/crews/errors/crew.errors.js';
import { CrewService } from '../../src/modules/crews/services/crew.service.js';
import type { CrewRepository } from '../../src/modules/crews/repositories/crew.repository.js';
import type { RoleAssignmentService } from '../../src/modules/authorization/services/role-assignment.service.js';
import type { SubscriptionService } from '../../src/modules/subscriptions/services/subscription.service.js';

const crewRow = () => ({
    id: 'crew-1',
    name: 'Vice Kings',
    tag: 'VK',
    description: null,
    level: 1,
    xp: 0n,
    influence: 0,
    prestige: 0,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
});

/**
 * Duplos declarados por fábrica, e não como Record, para que cada método
 * tenha tipo próprio: assim um nome mal escrito num teste falha a
 * compilar em vez de passar despercebido.
 */
const createRepositoryMock = () => ({
    findById: vi.fn().mockResolvedValue(crewRow()),
    findByNameOrTag: vi.fn().mockResolvedValue(null),
    createWithFounder: vi.fn().mockResolvedValue(crewRow()),
    updateCrew: vi.fn().mockResolvedValue(undefined),
    countActiveMembers: vi.fn().mockResolvedValue(1),
    findOpenMembership: vi.fn().mockResolvedValue(null),
    createJoinRequest: vi.fn().mockResolvedValue(undefined),
    setMembershipStatus: vi.fn().mockResolvedValue(undefined),
    listMembers: vi.fn().mockResolvedValue([]),
    listScopedRoles: vi.fn().mockResolvedValue([]),
});

const createRolesMock = () => ({
    setScopedRole: vi.fn().mockResolvedValue(undefined),
    revokeScopedRoles: vi.fn().mockResolvedValue(undefined),
    assertNotLastHolder: vi.fn().mockResolvedValue(undefined),
    getScopedRoleSlug: vi.fn().mockResolvedValue(null),
});

describe('CrewService', () => {
    let repository: ReturnType<typeof createRepositoryMock>;
    let roles: ReturnType<typeof createRolesMock>;
    let subscriptions: { getEntitlement: ReturnType<typeof vi.fn> };
    let service: CrewService;

    beforeEach(() => {
        repository = createRepositoryMock();
        roles = createRolesMock();
        subscriptions = {
            getEntitlement: vi
                .fn()
                .mockResolvedValue({ isPremium: false, activeUntil: null }),
        };

        service = new CrewService(
            repository as unknown as CrewRepository,
            roles as unknown as RoleAssignmentService,
            subscriptions as unknown as SubscriptionService,
        );
    });

    const expectCrewError = async (promise: Promise<unknown>, code: string) => {
        const error = await promise.catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(CrewError);
        expect((error as CrewError).code).toBe(code);
    };

    describe('criação', () => {
        const input = { name: 'Vice Kings', tag: 'VK', founderId: 'user-1' };

        it('faz do fundador o líder da crew que criou', async () => {
            await service.createCrew(input);

            expect(roles.setScopedRole).toHaveBeenCalledWith('user-1', 'crew_leader', {
                crewId: 'crew-1',
            });
        });

        it('recusa nome já em uso', async () => {
            repository.findByNameOrTag.mockResolvedValue({ name: 'Vice Kings', tag: 'X' });

            await expectCrewError(service.createCrew(input), 'CREW_NAME_TAKEN');
            expect(repository.createWithFounder).not.toHaveBeenCalled();
        });

        it('distingue tag já em uso de nome já em uso', async () => {
            repository.findByNameOrTag.mockResolvedValue({ name: 'Outra', tag: 'VK' });

            await expectCrewError(service.createCrew(input), 'CREW_TAG_TAKEN');
        });
    });

    describe('pedido de entrada', () => {
        it('cria pedido pendente', async () => {
            await service.requestToJoin('crew-1', 'user-2');

            expect(repository.createJoinRequest).toHaveBeenCalledWith('crew-1', 'user-2');
        });

        it('não dá cargo nenhum enquanto o pedido não for aceite', async () => {
            await service.requestToJoin('crew-1', 'user-2');

            /**
             * Pedir entrada não pode conceder poderes: só a aceitação o faz.
             */
            expect(roles.setScopedRole).not.toHaveBeenCalled();
        });

        it('recusa quem já tem pedido em aberto', async () => {
            repository.findOpenMembership.mockResolvedValue({ status: 'pending' });

            await expectCrewError(service.requestToJoin('crew-1', 'user-2'), 'ALREADY_MEMBER');
        });

        it('recusa quem já é membro', async () => {
            repository.findOpenMembership.mockResolvedValue({ status: 'active' });

            await expectCrewError(service.requestToJoin('crew-1', 'user-2'), 'ALREADY_MEMBER');
        });

        it('recusa entrada em crew inexistente', async () => {
            repository.findById.mockResolvedValue(null);

            await expectCrewError(service.requestToJoin('crew-x', 'user-2'), 'CREW_NOT_FOUND');
        });
    });

    describe('resposta ao pedido', () => {
        it('aceitar torna ativo e atribui cargo de membro', async () => {
            repository.findOpenMembership.mockResolvedValue({ id: 'm1', status: 'pending' });

            await service.acceptRequest('crew-1', 'user-2', 'user-1');

            expect(repository.setMembershipStatus).toHaveBeenCalledWith('m1', 'active', 'user-1');
            expect(roles.setScopedRole).toHaveBeenCalledWith('user-2', 'crew_member', {
                crewId: 'crew-1',
            });
        });

        it('recusar não atribui cargo nenhum', async () => {
            repository.findOpenMembership.mockResolvedValue({ id: 'm1', status: 'pending' });

            await service.rejectRequest('crew-1', 'user-2', 'user-1');

            expect(repository.setMembershipStatus).toHaveBeenCalledWith('m1', 'rejected', 'user-1');
            expect(roles.setScopedRole).not.toHaveBeenCalled();
        });

        it('recusa responder a um pedido já respondido', async () => {
            repository.findOpenMembership.mockResolvedValue({ id: 'm1', status: 'active' });

            await expectCrewError(
                service.acceptRequest('crew-1', 'user-2', 'user-1'),
                'MEMBERSHIP_NOT_PENDING',
            );
        });

        it('recusa responder a quem não pediu', async () => {
            repository.findOpenMembership.mockResolvedValue(null);

            await expectCrewError(
                service.acceptRequest('crew-1', 'user-2', 'user-1'),
                'MEMBERSHIP_NOT_FOUND',
            );
        });
    });

    describe('saída e remoção', () => {
        beforeEach(() => {
            repository.findOpenMembership.mockResolvedValue({ id: 'm1', status: 'active' });
        });

        it('sair retira os cargos que tinha na crew', async () => {
            await service.leave('crew-1', 'user-2');

            /**
             * Deixar de pertencer tem de levar consigo os poderes: caso
             * contrário continuaria a gerir uma crew de que já saiu.
             */
            expect(roles.revokeScopedRoles).toHaveBeenCalledWith('user-2', {
                crewId: 'crew-1',
            });
        });

        it('impede o último líder de sair', async () => {
            roles.assertNotLastHolder.mockRejectedValue(
                new AuthorizationError('LAST_ROLE_HOLDER', 'único líder', []),
            );

            await expect(service.leave('crew-1', 'user-1')).rejects.toBeInstanceOf(
                AuthorizationError,
            );

            expect(repository.setMembershipStatus).not.toHaveBeenCalled();
        });

        it('remover retira igualmente os cargos', async () => {
            await service.removeMember('crew-1', 'user-2', 'user-1');

            expect(roles.revokeScopedRoles).toHaveBeenCalledWith('user-2', {
                crewId: 'crew-1',
            });
        });

        it('não se remove a si próprio pela rota de gestão', async () => {
            await expectCrewError(
                service.removeMember('crew-1', 'user-1', 'user-1'),
                'CANNOT_MANAGE_SELF',
            );
        });

        it('recusa remover quem não é membro', async () => {
            repository.findOpenMembership.mockResolvedValue({ id: 'm1', status: 'pending' });

            await expectCrewError(
                service.removeMember('crew-1', 'user-2', 'user-1'),
                'NOT_A_MEMBER',
            );
        });
    });

    describe('cargos dos membros', () => {
        beforeEach(() => {
            repository.findOpenMembership.mockResolvedValue({ id: 'm1', status: 'active' });
        });

        it('altera o cargo de um membro', async () => {
            await service.setMemberRole('crew-1', 'user-2', 'crew_officer', 'user-1');

            expect(roles.setScopedRole).toHaveBeenCalledWith('user-2', 'crew_officer', {
                crewId: 'crew-1',
            });
        });

        it('não se altera o próprio cargo', async () => {
            await expectCrewError(
                service.setMemberRole('crew-1', 'user-1', 'crew_member', 'user-1'),
                'CANNOT_MANAGE_SELF',
            );
        });

        it('não despromove o único líder', async () => {
            roles.assertNotLastHolder.mockRejectedValue(
                new AuthorizationError('LAST_ROLE_HOLDER', 'único líder', []),
            );

            await expect(
                service.setMemberRole('crew-1', 'user-2', 'crew_member', 'user-1'),
            ).rejects.toBeInstanceOf(AuthorizationError);

            expect(roles.setScopedRole).not.toHaveBeenCalled();
        });
    });

    describe('perfil', () => {
        it('mostra o selo premium da crew, não o de quem consulta', async () => {
            subscriptions.getEntitlement.mockResolvedValue({
                isPremium: true,
                activeUntil: new Date(),
            });

            const perfil = await service.getProfile('crew-1');

            expect(subscriptions.getEntitlement).toHaveBeenCalledWith({ crewId: 'crew-1' });
            expect(perfil.isPremium).toBe(true);
        });

        it('devolve 404 de domínio quando a crew não existe', async () => {
            repository.findById.mockResolvedValue(null);

            await expectCrewError(service.getProfile('crew-x'), 'CREW_NOT_FOUND');
        });
    });
});
