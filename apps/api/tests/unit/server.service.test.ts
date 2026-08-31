import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorizationError } from '../../src/modules/authorization/errors/authorization.errors.js';
import { ServerError } from '../../src/modules/servers/errors/server.errors.js';
import { ServerService } from '../../src/modules/servers/services/server.service.js';
import type { ServerRepository } from '../../src/modules/servers/repositories/server.repository.js';
import type { RoleAssignmentService } from '../../src/modules/authorization/services/role-assignment.service.js';
import type { SubscriptionService } from '../../src/modules/subscriptions/services/subscription.service.js';

const serverRow = () => ({
    id: 'server-1',
    name: 'Vice City RP',
    region: 'eu-west',
    description: null,
    isOnline: false,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
});

/**
 * Duplos declarados por fábrica, e não como Record, para que cada método
 * tenha tipo próprio: assim um nome mal escrito num teste falha a
 * compilar em vez de passar despercebido.
 */
const createRepositoryMock = () => ({
    findById: vi.fn().mockResolvedValue(serverRow()),
    findByName: vi.fn().mockResolvedValue(null),
    createWithOwner: vi.fn().mockResolvedValue(serverRow()),
    updateServer: vi.fn().mockResolvedValue(undefined),
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

const activeMembership = { id: 'membership-1', status: 'active' };
const pendingMembership = { id: 'membership-1', status: 'pending' };

describe('ServerService', () => {
    let repository: ReturnType<typeof createRepositoryMock>;
    let roles: ReturnType<typeof createRolesMock>;
    let subscriptions: { getEntitlement: ReturnType<typeof vi.fn> };
    let service: ServerService;

    beforeEach(() => {
        repository = createRepositoryMock();
        roles = createRolesMock();
        subscriptions = {
            getEntitlement: vi
                .fn()
                .mockResolvedValue({ isPremium: false, activeUntil: null }),
        };

        service = new ServerService(
            repository as unknown as ServerRepository,
            roles as unknown as RoleAssignmentService,
            subscriptions as unknown as SubscriptionService,
        );
    });

    const expectServerError = async (promise: Promise<unknown>, code: string) => {
        const error = await promise.catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ServerError);
        expect((error as ServerError).code).toBe(code);
    };

    describe('criação', () => {
        const input = { name: 'Vice City RP', ownerId: 'user-1' };

        it('faz de quem criou o dono do servidor', async () => {
            await service.createServer(input);

            expect(roles.setScopedRole).toHaveBeenCalledWith('user-1', 'server_owner', {
                serverId: 'server-1',
            });
        });

        it('recusa um nome já usado', async () => {
            repository.findByName.mockResolvedValue({ name: 'Vice City RP' });

            await expectServerError(service.createServer(input), 'SERVER_NAME_TAKEN');

            expect(repository.createWithOwner).not.toHaveBeenCalled();
        });

        /**
         * O cargo é a única fonte de verdade sobre quem manda. Criar o
         * servidor sem o atribuir deixaria-o sem dono.
         */
        it('não atribui cargo nenhum quando a criação falha', async () => {
            repository.findByName.mockResolvedValue({ name: 'Vice City RP' });

            await service.createServer(input).catch(() => undefined);

            expect(roles.setScopedRole).not.toHaveBeenCalled();
        });
    });

    describe('perfil', () => {
        it('devolve 404 para um servidor que não existe', async () => {
            repository.findById.mockResolvedValue(null);

            await expectServerError(service.getProfile('server-1'), 'SERVER_NOT_FOUND');
        });

        it('reflete a subscrição do próprio servidor, e não a de quem consulta', async () => {
            subscriptions.getEntitlement.mockResolvedValue({
                isPremium: true,
                activeUntil: new Date('2026-12-01T00:00:00.000Z'),
            });

            const profile = await service.getProfile('server-1');

            expect(subscriptions.getEntitlement).toHaveBeenCalledWith({
                serverId: 'server-1',
            });
            expect(profile.isPremium).toBe(true);
        });
    });

    describe('alteração do servidor', () => {
        it('recusa um nome já usado por outro servidor', async () => {
            repository.findByName.mockResolvedValue({ name: 'Outro' });

            await expectServerError(
                service.updateServer('server-1', { name: 'Outro' }),
                'SERVER_NAME_TAKEN',
            );

            expect(repository.updateServer).not.toHaveBeenCalled();
        });

        it('não verifica o nome quando ele não é alterado', async () => {
            await service.updateServer('server-1', { isOnline: true });

            expect(repository.findByName).not.toHaveBeenCalled();
            expect(repository.updateServer).toHaveBeenCalledWith('server-1', {
                isOnline: true,
            });
        });
    });

    describe('pedido de entrada', () => {
        it('cria o pedido pendente sem conceder cargo nenhum', async () => {
            await service.requestToJoin('server-1', 'user-2');

            expect(repository.createJoinRequest).toHaveBeenCalledWith(
                'server-1',
                'user-2',
            );
            expect(roles.setScopedRole).not.toHaveBeenCalled();
        });

        it('recusa quem já pertence ao servidor', async () => {
            repository.findOpenMembership.mockResolvedValue(activeMembership);

            await expectServerError(
                service.requestToJoin('server-1', 'user-2'),
                'ALREADY_MEMBER',
            );
        });

        it('recusa um segundo pedido enquanto o primeiro está por responder', async () => {
            repository.findOpenMembership.mockResolvedValue(pendingMembership);

            await expectServerError(
                service.requestToJoin('server-1', 'user-2'),
                'ALREADY_MEMBER',
            );

            expect(repository.createJoinRequest).not.toHaveBeenCalled();
        });

        it('recusa entrar num servidor que não existe', async () => {
            repository.findById.mockResolvedValue(null);

            await expectServerError(
                service.requestToJoin('server-1', 'user-2'),
                'SERVER_NOT_FOUND',
            );
        });
    });

    describe('retirada do pedido', () => {
        it('encerra o pedido pendente e deixa voltar a candidatar-se', async () => {
            repository.findOpenMembership.mockResolvedValue(pendingMembership);

            await service.withdrawJoinRequest('server-1', 'user-2');

            expect(repository.setMembershipStatus).toHaveBeenCalledWith(
                'membership-1',
                'left',
                'user-2',
            );
        });

        it('recusa retirar um pedido já aceite', async () => {
            repository.findOpenMembership.mockResolvedValue(activeMembership);

            await expectServerError(
                service.withdrawJoinRequest('server-1', 'user-2'),
                'MEMBERSHIP_NOT_PENDING',
            );
        });

        it('recusa quando não há pedido nenhum', async () => {
            await expectServerError(
                service.withdrawJoinRequest('server-1', 'user-2'),
                'MEMBERSHIP_NOT_FOUND',
            );
        });
    });

    describe('resposta a pedidos', () => {
        it('aceitar torna a adesão ativa e concede o cargo de membro', async () => {
            repository.findOpenMembership.mockResolvedValue(pendingMembership);

            await service.acceptRequest('server-1', 'user-2', 'owner-1');

            expect(repository.setMembershipStatus).toHaveBeenCalledWith(
                'membership-1',
                'active',
                'owner-1',
            );
            expect(roles.setScopedRole).toHaveBeenCalledWith('user-2', 'server_member', {
                serverId: 'server-1',
            });
        });

        it('recusar não concede cargo nenhum', async () => {
            repository.findOpenMembership.mockResolvedValue(pendingMembership);

            await service.rejectRequest('server-1', 'user-2', 'owner-1');

            expect(repository.setMembershipStatus).toHaveBeenCalledWith(
                'membership-1',
                'rejected',
                'owner-1',
            );
            expect(roles.setScopedRole).not.toHaveBeenCalled();
        });

        it('recusa responder duas vezes ao mesmo pedido', async () => {
            repository.findOpenMembership.mockResolvedValue(activeMembership);

            await expectServerError(
                service.acceptRequest('server-1', 'user-2', 'owner-1'),
                'MEMBERSHIP_NOT_PENDING',
            );
        });
    });

    describe('saída', () => {
        beforeEach(() => {
            repository.findOpenMembership.mockResolvedValue(activeMembership);
        });

        it('retira os cargos que tinha no servidor', async () => {
            await service.leave('server-1', 'user-2');

            expect(roles.revokeScopedRoles).toHaveBeenCalledWith('user-2', {
                serverId: 'server-1',
            });
        });

        /**
         * Um servidor sem dono fica sem quem aceite membros ou altere
         * cargos, e não haveria forma de o recuperar pela própria API.
         */
        it('recusa a saída do único dono', async () => {
            roles.assertNotLastHolder.mockRejectedValue(
                new AuthorizationError('LAST_ROLE_HOLDER', 'único', []),
            );

            const error = await service
                .leave('server-1', 'user-2')
                .catch((caught: unknown) => caught);

            expect(error).toBeInstanceOf(AuthorizationError);
            expect(repository.setMembershipStatus).not.toHaveBeenCalled();
            expect(roles.revokeScopedRoles).not.toHaveBeenCalled();
        });

        it('recusa a saída de quem não é membro', async () => {
            repository.findOpenMembership.mockResolvedValue(pendingMembership);

            await expectServerError(service.leave('server-1', 'user-2'), 'NOT_A_MEMBER');
        });
    });

    describe('remoção de membros', () => {
        beforeEach(() => {
            repository.findOpenMembership.mockResolvedValue(activeMembership);
        });

        it('retira a adesão e os cargos', async () => {
            await service.removeMember('server-1', 'user-2', 'owner-1');

            expect(repository.setMembershipStatus).toHaveBeenCalledWith(
                'membership-1',
                'left',
                'owner-1',
            );
            expect(roles.revokeScopedRoles).toHaveBeenCalledWith('user-2', {
                serverId: 'server-1',
            });
        });

        it('não deixa alguém remover-se pela rota de gestão', async () => {
            await expectServerError(
                service.removeMember('server-1', 'owner-1', 'owner-1'),
                'CANNOT_MANAGE_SELF',
            );
        });

        it('recusa remover o único dono', async () => {
            roles.assertNotLastHolder.mockRejectedValue(
                new AuthorizationError('LAST_ROLE_HOLDER', 'único', []),
            );

            await service
                .removeMember('server-1', 'user-2', 'owner-1')
                .catch(() => undefined);

            expect(repository.setMembershipStatus).not.toHaveBeenCalled();
        });
    });

    describe('alteração de cargos', () => {
        beforeEach(() => {
            repository.findOpenMembership.mockResolvedValue(activeMembership);
        });

        it('atribui o cargo pedido no âmbito do servidor', async () => {
            await service.setMemberRole(
                'server-1',
                'user-2',
                'server_moderator',
                'owner-1',
            );

            expect(roles.setScopedRole).toHaveBeenCalledWith(
                'user-2',
                'server_moderator',
                { serverId: 'server-1' },
            );
        });

        it('não deixa alguém alterar o próprio cargo', async () => {
            await expectServerError(
                service.setMemberRole('server-1', 'owner-1', 'server_owner', 'owner-1'),
                'CANNOT_MANAGE_SELF',
            );

            expect(roles.setScopedRole).not.toHaveBeenCalled();
        });

        it('recusa despromover o único dono', async () => {
            roles.assertNotLastHolder.mockRejectedValue(
                new AuthorizationError('LAST_ROLE_HOLDER', 'único', []),
            );

            await service
                .setMemberRole('server-1', 'user-2', 'server_member', 'owner-1')
                .catch(() => undefined);

            expect(roles.setScopedRole).not.toHaveBeenCalled();
        });

        it('recusa alterar o cargo de quem não é membro', async () => {
            repository.findOpenMembership.mockResolvedValue(null);

            await expectServerError(
                service.setMemberRole('server-1', 'user-2', 'server_member', 'owner-1'),
                'NOT_A_MEMBER',
            );
        });
    });

    describe('listagens', () => {
        it('junta a cada membro o cargo que tem no servidor', async () => {
            repository.listMembers.mockResolvedValue([
                {
                    created_at: new Date('2026-02-01T00:00:00.000Z'),
                    user: { id: 'user-2', username: 'tommy', avatarUrl: null },
                },
                {
                    created_at: new Date('2026-02-02T00:00:00.000Z'),
                    user: { id: 'user-3', username: 'lance', avatarUrl: null },
                },
            ]);

            repository.listScopedRoles.mockResolvedValue([
                { userId: 'user-2', role: { slug: 'server_moderator' } },
            ]);

            const membros = await service.listMembers('server-1');

            expect(membros).toEqual([
                {
                    userId: 'user-2',
                    username: 'tommy',
                    avatarUrl: null,
                    role: 'server_moderator',
                    joinedAt: new Date('2026-02-01T00:00:00.000Z'),
                },
                {
                    userId: 'user-3',
                    username: 'lance',
                    avatarUrl: null,
                    role: null,
                    joinedAt: new Date('2026-02-02T00:00:00.000Z'),
                },
            ]);
        });

        it('os pedidos pendentes são lidos separadamente dos membros', async () => {
            await service.listJoinRequests('server-1');

            expect(repository.listMembers).toHaveBeenCalledWith('server-1', 'pending');
        });
    });
});
