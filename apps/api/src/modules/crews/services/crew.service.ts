import { MembershipStatus, ROLES, type RoleKey } from '@vicehub/database';

import type { RoleAssignmentService } from '../../authorization/services/role-assignment.service.js';
import type { SubscriptionService } from '../../subscriptions/services/subscription.service.js';
import { CrewError } from '../errors/crew.errors.js';
import type { CrewRepository } from '../repositories/crew.repository.js';
import type {
    CrewJoinRequest,
    CrewMember,
    CrewProfile,
    CrewRecord,
} from '../types/crew.types.js';

interface CreateCrewInput {
    name: string;
    tag: string;
    description?: string | null | undefined;
    founderId: string;
}

interface UpdateCrewInput {
    name?: string | undefined;
    description?: string | null | undefined;
}

/**
 * Serviço de crews.
 *
 * A pertença e a autorização são coisas distintas e vivem em sítios
 * distintos: o Membership diz quem pertence, o RBAC diz quem manda. Este
 * serviço mantém as duas coerentes — entrar dá cargo, sair retira-o.
 */
export class CrewService {
    constructor(
        private readonly crewRepository: CrewRepository,
        private readonly roleAssignmentService: RoleAssignmentService,
        private readonly subscriptionService: SubscriptionService,
    ) { }

    /**
     * Cria uma crew e faz do fundador o seu líder.
     */
    async createCrew(input: CreateCrewInput): Promise<CrewProfile> {
        const existente = await this.crewRepository.findByNameOrTag(
            input.name,
            input.tag,
        );

        if (existente) {
            throw existente.name === input.name
                ? new CrewError('CREW_NAME_TAKEN', 'Já existe uma crew com este nome.')
                : new CrewError('CREW_TAG_TAKEN', 'Já existe uma crew com esta tag.');
        }

        const crew = await this.crewRepository.createWithFounder(input);

        await this.roleAssignmentService.setScopedRole(
            input.founderId,
            'crew_leader',
            { crewId: crew.id },
        );

        return this.buildProfile(crew);
    }

    async getProfile(crewId: string): Promise<CrewProfile> {
        return this.buildProfile(await this.requireCrew(crewId));
    }

    async updateCrew(
        crewId: string,
        input: UpdateCrewInput,
    ): Promise<CrewProfile> {
        await this.requireCrew(crewId);

        if (input.name !== undefined) {
            const existente = await this.crewRepository.findByNameOrTag(
                input.name,
                '',
            );

            if (existente && existente.name === input.name) {
                throw new CrewError(
                    'CREW_NAME_TAKEN',
                    'Já existe uma crew com este nome.',
                );
            }
        }

        await this.crewRepository.updateCrew(crewId, input);

        return this.getProfile(crewId);
    }

    /**
     * Pede entrada numa crew.
     *
     * O pedido fica pendente até alguém com autorização responder.
     */
    async requestToJoin(crewId: string, userId: string): Promise<void> {
        await this.requireCrew(crewId);

        const aberta = await this.crewRepository.findOpenMembership(crewId, userId);

        if (aberta) {
            throw new CrewError(
                'ALREADY_MEMBER',
                aberta.status === MembershipStatus.active
                    ? 'Já pertences a esta crew.'
                    : 'Já tens um pedido pendente nesta crew.',
            );
        }

        await this.crewRepository.createJoinRequest(crewId, userId);
    }

    /**
     * Aceita um pedido de entrada e atribui o cargo de membro.
     */
    async acceptRequest(
        crewId: string,
        userId: string,
        respondedBy: string,
    ): Promise<void> {
        const adesao = await this.requirePendingMembership(crewId, userId);

        await this.crewRepository.setMembershipStatus(
            adesao.id,
            MembershipStatus.active,
            respondedBy,
        );

        await this.roleAssignmentService.setScopedRole(userId, 'crew_member', {
            crewId,
        });
    }

    async rejectRequest(
        crewId: string,
        userId: string,
        respondedBy: string,
    ): Promise<void> {
        const adesao = await this.requirePendingMembership(crewId, userId);

        await this.crewRepository.setMembershipStatus(
            adesao.id,
            MembershipStatus.rejected,
            respondedBy,
        );
    }

    /**
     * Sai da crew por vontade própria.
     */
    async leave(crewId: string, userId: string): Promise<void> {
        const adesao = await this.requireActiveMembership(crewId, userId);

        /**
         * Sair sendo o único líder deixaria a crew sem quem aceitasse
         * membros ou alterasse cargos, sem forma de a recuperar.
         */
        await this.roleAssignmentService.assertNotLastHolder(
            userId,
            'crew_leader',
            { crewId },
        );

        await this.crewRepository.setMembershipStatus(
            adesao.id,
            MembershipStatus.left,
            userId,
        );

        await this.roleAssignmentService.revokeScopedRoles(userId, { crewId });
    }

    /**
     * Remove um membro da crew.
     */
    async removeMember(
        crewId: string,
        userId: string,
        removedBy: string,
    ): Promise<void> {
        if (userId === removedBy) {
            throw new CrewError(
                'CANNOT_MANAGE_SELF',
                'Para saíres da crew usa a rota de saída.',
            );
        }

        const adesao = await this.requireActiveMembership(crewId, userId);

        await this.roleAssignmentService.assertNotLastHolder(
            userId,
            'crew_leader',
            { crewId },
        );

        await this.crewRepository.setMembershipStatus(
            adesao.id,
            MembershipStatus.left,
            removedBy,
        );

        await this.roleAssignmentService.revokeScopedRoles(userId, { crewId });
    }

    /**
     * Altera o cargo de um membro dentro da crew.
     */
    async setMemberRole(
        crewId: string,
        userId: string,
        role: RoleKey,
        changedBy: string,
    ): Promise<void> {
        if (userId === changedBy) {
            throw new CrewError(
                'CANNOT_MANAGE_SELF',
                'Não podes alterar o teu próprio cargo.',
            );
        }

        await this.requireActiveMembership(crewId, userId);

        /**
         * Despromover o único líder tem o mesmo efeito que ele sair.
         */
        await this.roleAssignmentService.assertNotLastHolder(
            userId,
            'crew_leader',
            { crewId },
        );

        await this.roleAssignmentService.setScopedRole(userId, role, { crewId });
    }

    async listMembers(crewId: string): Promise<CrewMember[]> {
        await this.requireCrew(crewId);

        const adesoes = await this.crewRepository.listMembers(
            crewId,
            MembershipStatus.active,
        );

        const cargos = await this.crewRepository.listScopedRoles(
            crewId,
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

    async listJoinRequests(crewId: string): Promise<CrewJoinRequest[]> {
        await this.requireCrew(crewId);

        const pedidos = await this.crewRepository.listMembers(
            crewId,
            MembershipStatus.pending,
        );

        return pedidos.map((pedido) => ({
            userId: pedido.user.id,
            username: pedido.user.username,
            avatarUrl: pedido.user.avatarUrl,
            requestedAt: pedido.created_at,
        }));
    }

    private async requireCrew(crewId: string): Promise<CrewRecord> {
        const crew = await this.crewRepository.findById(crewId);

        if (!crew) {
            throw new CrewError('CREW_NOT_FOUND', 'Crew não encontrada.');
        }

        return crew;
    }

    private async requirePendingMembership(crewId: string, userId: string) {
        const adesao = await this.crewRepository.findOpenMembership(crewId, userId);

        if (!adesao) {
            throw new CrewError(
                'MEMBERSHIP_NOT_FOUND',
                'Não existe pedido de entrada deste utilizador.',
            );
        }

        if (adesao.status !== MembershipStatus.pending) {
            throw new CrewError(
                'MEMBERSHIP_NOT_PENDING',
                'Este pedido já foi respondido.',
            );
        }

        return adesao;
    }

    private async requireActiveMembership(crewId: string, userId: string) {
        const adesao = await this.crewRepository.findOpenMembership(crewId, userId);

        if (!adesao || adesao.status !== MembershipStatus.active) {
            throw new CrewError('NOT_A_MEMBER', 'Este utilizador não pertence à crew.');
        }

        return adesao;
    }

    private async buildProfile(crew: CrewRecord): Promise<CrewProfile> {
        const [entitlement, memberCount] = await Promise.all([
            this.subscriptionService.getEntitlement({ crewId: crew.id }),
            this.crewRepository.countActiveMembers(crew.id),
        ]);

        return {
            id: crew.id,
            name: crew.name,
            tag: crew.tag,
            description: crew.description,
            level: crew.level,
            xp: crew.xp,
            influence: crew.influence,
            prestige: crew.prestige,
            isPremium: entitlement.isPremium,
            memberCount,
            createdAt: crew.created_at,
        };
    }
}

export const CREW_ROLE_KEYS: RoleKey[] = ['crew_leader', 'crew_officer', 'crew_member'];
export const CREW_ROLES = ROLES;
