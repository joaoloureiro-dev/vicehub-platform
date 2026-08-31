import { ROLES, RoleScope, type RoleKey } from '@vicehub/database';

import { AuthorizationError } from '../errors/authorization.errors.js';
import type { RoleAssignmentRepository } from '../repositories/role-assignment.repository.js';
import type { AuthorizationScope } from '../types/authorization.types.js';

/**
 * Concede e retira cargos.
 *
 * Os cargos são criados pelo seed; este serviço apenas os atribui. Se um
 * cargo do catálogo não existir na base de dados, falha em vez de deixar
 * alguém sem os poderes que devia ter.
 */
export class RoleAssignmentService {
    constructor(
        private readonly roleAssignmentRepository: RoleAssignmentRepository,
    ) { }

    /**
     * Define o cargo de um utilizador num âmbito, substituindo o anterior.
     */
    async setScopedRole(
        userId: string,
        roleKey: RoleKey,
        scope: AuthorizationScope,
    ): Promise<void> {
        const definicao = ROLES[roleKey];

        const role = await this.roleAssignmentRepository.findRoleIdBySlug(
            definicao.slug,
            definicao.scope,
        );

        if (!role) {
            throw new Error(
                `[ViceHub] O cargo "${definicao.slug}" não existe na base de dados. Corre "npm run db:seed".`,
            );
        }

        const atuais = await this.roleAssignmentRepository.findScopedRoleIds(
            userId,
            scope,
        );

        await this.roleAssignmentRepository.replaceScopedRole({
            userId,
            roleId: role.id,
            scope,
            currentRoleIds: atuais.map((entrada) => entrada.roleId),
        });
    }

    /**
     * Retira todos os cargos de um utilizador num âmbito.
     */
    async revokeScopedRoles(
        userId: string,
        scope: AuthorizationScope,
    ): Promise<void> {
        await this.roleAssignmentRepository.revokeRolesInScope(userId, scope);
    }

    /**
     * Devolve o cargo que um utilizador tem num âmbito, se tiver algum.
     */
    async getScopedRoleSlug(
        userId: string,
        scope: AuthorizationScope,
    ): Promise<string | null> {
        const atuais = await this.roleAssignmentRepository.findScopedRoleIds(
            userId,
            scope,
        );

        return atuais[0]?.role.slug ?? null;
    }

    /**
     * Recusa a operação se ela deixasse o âmbito sem ninguém no cargo.
     *
     * Uma crew sem líder, ou um servidor sem dono, fica sem quem aceite
     * membros ou altere cargos, e não haveria forma de o recuperar pela
     * própria API.
     */
    async assertNotLastHolder(
        userId: string,
        roleKey: RoleKey,
        scope: AuthorizationScope,
    ): Promise<void> {
        const atual = await this.getScopedRoleSlug(userId, scope);

        if (atual !== ROLES[roleKey].slug) {
            return;
        }

        const role = await this.roleAssignmentRepository.findRoleIdBySlug(
            ROLES[roleKey].slug,
            ROLES[roleKey].scope,
        );

        if (!role) {
            return;
        }

        const total = await this.roleAssignmentRepository.countHoldersOfRole(
            role.id,
            scope,
        );

        if (total <= 1) {
            throw new AuthorizationError(
                'LAST_ROLE_HOLDER',
                'És o único com este cargo. Passa-o a outro membro antes de saíres ou de mudares de cargo.',
                [],
            );
        }
    }
}

export const CREW_ROLE_SCOPE = RoleScope.crew;
