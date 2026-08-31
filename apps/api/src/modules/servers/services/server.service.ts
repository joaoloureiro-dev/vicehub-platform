import { MembershipStatus, type RoleKey } from '@vicehub/database';

import type { RoleAssignmentService } from '../../authorization/services/role-assignment.service.js';
import type { SubscriptionService } from '../../subscriptions/services/subscription.service.js';
import { ServerError } from '../errors/server.errors.js';
import type { ServerRepository } from '../repositories/server.repository.js';
import type {
    ServerJoinRequest,
    ServerMember,
    ServerProfile,
    ServerRecord,
} from '../types/server.types.js';

interface CreateServerInput {
    name: string;
    region?: string | null | undefined;
    description?: string | null | undefined;
    ownerId: string;
}

interface UpdateServerInput {
    name?: string | undefined;
    region?: string | null | undefined;
    description?: string | null | undefined;
    isOnline?: boolean | undefined;
}

/**
 * Serviço de servidores.
 *
 * Segue o mesmo desenho do serviço de crews: o Membership diz quem
 * pertence, o RBAC diz quem manda, e é aqui que os dois se mantêm
 * coerentes — ser aceite dá cargo, sair ou ser removido retira-o.
 */
export class ServerService {
    constructor(
        private readonly serverRepository: ServerRepository,
        private readonly roleAssignmentService: RoleAssignmentService,
        private readonly subscriptionService: SubscriptionService,
    ) { }

    /**
     * Cria um servidor e faz de quem o criou o seu dono.
     */
    async createServer(input: CreateServerInput): Promise<ServerProfile> {
        const existente = await this.serverRepository.findByName(input.name);

        if (existente) {
            throw new ServerError(
                'SERVER_NAME_TAKEN',
                'Já existe um servidor com este nome.',
            );
        }

        const server = await this.serverRepository.createWithOwner(input);

        await this.roleAssignmentService.setScopedRole(input.ownerId, 'server_owner', {
            serverId: server.id,
        });

        return this.buildProfile(server);
    }

    async getProfile(serverId: string): Promise<ServerProfile> {
        return this.buildProfile(await this.requireServer(serverId));
    }

    async updateServer(
        serverId: string,
        input: UpdateServerInput,
    ): Promise<ServerProfile> {
        await this.requireServer(serverId);

        if (input.name !== undefined) {
            const existente = await this.serverRepository.findByName(input.name);

            if (existente) {
                throw new ServerError(
                    'SERVER_NAME_TAKEN',
                    'Já existe um servidor com este nome.',
                );
            }
        }

        await this.serverRepository.updateServer(serverId, input);

        return this.getProfile(serverId);
    }

    /**
     * Pede entrada num servidor.
     *
     * O pedido fica pendente até alguém com autorização responder.
     */
    async requestToJoin(serverId: string, userId: string): Promise<void> {
        await this.requireServer(serverId);

        const aberta = await this.serverRepository.findOpenMembership(
            serverId,
            userId,
        );

        if (aberta) {
            throw new ServerError(
                'ALREADY_MEMBER',
                aberta.status === MembershipStatus.active
                    ? 'Já pertences a este servidor.'
                    : 'Já tens um pedido pendente neste servidor.',
            );
        }

        await this.serverRepository.createJoinRequest(serverId, userId);
    }

    /**
     * Retira um pedido de entrada ainda por responder.
     *
     * Sem isto, quem se candidata fica preso: a rota de saída exige uma
     * adesão ativa, e um pedido pendente bloqueia qualquer novo pedido.
     */
    async withdrawJoinRequest(serverId: string, userId: string): Promise<void> {
        const adesao = await this.requirePendingMembership(serverId, userId);

        await this.serverRepository.setMembershipStatus(
            adesao.id,
            MembershipStatus.left,
            userId,
        );
    }

    /**
     * Aceita um pedido de entrada e atribui o cargo de membro.
     */
    async acceptRequest(
        serverId: string,
        userId: string,
        respondedBy: string,
    ): Promise<void> {
        const adesao = await this.requirePendingMembership(serverId, userId);

        await this.serverRepository.setMembershipStatus(
            adesao.id,
            MembershipStatus.active,
            respondedBy,
        );

        await this.roleAssignmentService.setScopedRole(userId, 'server_member', {
            serverId,
        });
    }

    async rejectRequest(
        serverId: string,
        userId: string,
        respondedBy: string,
    ): Promise<void> {
        const adesao = await this.requirePendingMembership(serverId, userId);

        await this.serverRepository.setMembershipStatus(
            adesao.id,
            MembershipStatus.rejected,
            respondedBy,
        );
    }

    /**
     * Sai do servidor por vontade própria.
     */
    async leave(serverId: string, userId: string): Promise<void> {
        const adesao = await this.requireActiveMembership(serverId, userId);

        /**
         * Sair sendo o único dono deixaria o servidor sem quem aceitasse
         * membros ou alterasse cargos, sem forma de o recuperar.
         */
        await this.roleAssignmentService.assertNotLastHolder(userId, 'server_owner', {
            serverId,
        });

        await this.serverRepository.setMembershipStatus(
            adesao.id,
            MembershipStatus.left,
            userId,
        );

        await this.roleAssignmentService.revokeScopedRoles(userId, { serverId });
    }

    /**
     * Remove um membro do servidor.
     */
    async removeMember(
        serverId: string,
        userId: string,
        removedBy: string,
    ): Promise<void> {
        if (userId === removedBy) {
            throw new ServerError(
                'CANNOT_MANAGE_SELF',
                'Para saíres do servidor usa a rota de saída.',
            );
        }

        const adesao = await this.requireActiveMembership(serverId, userId);

        await this.roleAssignmentService.assertNotLastHolder(userId, 'server_owner', {
            serverId,
        });

        await this.serverRepository.setMembershipStatus(
            adesao.id,
            MembershipStatus.left,
            removedBy,
        );

        await this.roleAssignmentService.revokeScopedRoles(userId, { serverId });
    }

    /**
     * Altera o cargo de um membro dentro do servidor.
     */
    async setMemberRole(
        serverId: string,
        userId: string,
        role: RoleKey,
        changedBy: string,
    ): Promise<void> {
        if (userId === changedBy) {
            throw new ServerError(
                'CANNOT_MANAGE_SELF',
                'Não podes alterar o teu próprio cargo.',
            );
        }

        await this.requireActiveMembership(serverId, userId);

        /**
         * Despromover o único dono tem o mesmo efeito que ele sair.
         */
        await this.roleAssignmentService.assertNotLastHolder(userId, 'server_owner', {
            serverId,
        });

        await this.roleAssignmentService.setScopedRole(userId, role, { serverId });
    }

    async listMembers(serverId: string): Promise<ServerMember[]> {
        await this.requireServer(serverId);

        const adesoes = await this.serverRepository.listMembers(
            serverId,
            MembershipStatus.active,
        );

        const cargos = await this.serverRepository.listScopedRoles(
            serverId,
            adesoes.map((adesao) => adesao.user.id),
        );

        const porUtilizador = new Map(
            cargos.map((cargo) => [cargo.userId, cargo.role.slug]),
        );

        return adesoes.map((adesao) => ({
            userId: adesao.user.id,
            username: adesao.user.username,
            avatarUrl: adesao.user.avatarUrl,
            role: porUtilizador.get(adesao.user.id) ?? null,
            joinedAt: adesao.created_at,
        }));
    }

    async listJoinRequests(serverId: string): Promise<ServerJoinRequest[]> {
        await this.requireServer(serverId);

        const pedidos = await this.serverRepository.listMembers(
            serverId,
            MembershipStatus.pending,
        );

        return pedidos.map((pedido) => ({
            userId: pedido.user.id,
            username: pedido.user.username,
            avatarUrl: pedido.user.avatarUrl,
            requestedAt: pedido.created_at,
        }));
    }

    private async requireServer(serverId: string): Promise<ServerRecord> {
        const server = await this.serverRepository.findById(serverId);

        if (!server) {
            throw new ServerError('SERVER_NOT_FOUND', 'Servidor não encontrado.');
        }

        return server;
    }

    private async requirePendingMembership(serverId: string, userId: string) {
        const adesao = await this.serverRepository.findOpenMembership(
            serverId,
            userId,
        );

        if (!adesao) {
            throw new ServerError(
                'MEMBERSHIP_NOT_FOUND',
                'Não existe pedido de entrada deste utilizador.',
            );
        }

        if (adesao.status !== MembershipStatus.pending) {
            throw new ServerError(
                'MEMBERSHIP_NOT_PENDING',
                'Este pedido já foi respondido.',
            );
        }

        return adesao;
    }

    private async requireActiveMembership(serverId: string, userId: string) {
        const adesao = await this.serverRepository.findOpenMembership(
            serverId,
            userId,
        );

        if (!adesao || adesao.status !== MembershipStatus.active) {
            throw new ServerError(
                'NOT_A_MEMBER',
                'Este utilizador não pertence ao servidor.',
            );
        }

        return adesao;
    }

    private async buildProfile(server: ServerRecord): Promise<ServerProfile> {
        const [entitlement, memberCount] = await Promise.all([
            this.subscriptionService.getEntitlement({ serverId: server.id }),
            this.serverRepository.countActiveMembers(server.id),
        ]);

        return {
            id: server.id,
            name: server.name,
            region: server.region,
            description: server.description,
            isOnline: server.isOnline,
            isPremium: entitlement.isPremium,
            memberCount,
            createdAt: server.created_at,
        };
    }
}
