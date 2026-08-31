import { RoleScope, SourceType, type DatabaseClient } from '@vicehub/database';

import type { AuthorizationScope } from '../types/authorization.types.js';

/**
 * Escritas sobre atribuições de cargos.
 *
 * Vive no módulo de autorização, e não em quem o consome, para que
 * conceder e retirar poderes seja sempre feito pelo mesmo caminho.
 */
export class RoleAssignmentRepository {
    constructor(private readonly database: DatabaseClient) { }

    findRoleIdBySlug(slug: string, scope: RoleScope) {
        return this.database.role.findFirst({
            where: { slug, scope, is_deleted: false },
            select: { id: true },
        });
    }

    /**
     * Substitui os cargos de um utilizador dentro de um âmbito.
     *
     * Retirar os anteriores e atribuir o novo acontece na mesma
     * transação: sem isso, um erro a meio deixaria alguém com dois
     * cargos na mesma crew, ou com nenhum.
     */
    replaceScopedRole(input: {
        userId: string;
        roleId: string;
        scope: AuthorizationScope;
        currentRoleIds: string[];
    }) {
        const now = new Date();

        return this.database.$transaction([
            this.database.userRole.updateMany({
                where: {
                    userId: input.userId,
                    crewId: input.scope.crewId ?? null,
                    serverId: input.scope.serverId ?? null,
                    roleId: { in: input.currentRoleIds },
                    is_deleted: false,
                },
                data: {
                    is_deleted: true,
                    deleted_at: now,
                    version: { increment: 1 },
                },
            }),
            this.database.userRole.create({
                data: {
                    userId: input.userId,
                    roleId: input.roleId,
                    crewId: input.scope.crewId ?? null,
                    serverId: input.scope.serverId ?? null,
                    source: SourceType.api,
                },
            }),
        ]);
    }

    /**
     * Retira todos os cargos de um utilizador num âmbito.
     *
     * Usado quando alguém deixa de pertencer: sair de uma crew tem de
     * levar consigo os poderes que lá tinha.
     */
    revokeRolesInScope(userId: string, scope: AuthorizationScope) {
        return this.database.userRole.updateMany({
            where: {
                userId,
                crewId: scope.crewId ?? null,
                serverId: scope.serverId ?? null,
                is_deleted: false,
            },
            data: {
                is_deleted: true,
                deleted_at: new Date(),
                version: { increment: 1 },
            },
        });
    }

    /**
     * Conta quantos utilizadores têm um dado cargo num âmbito.
     *
     * Serve para impedir que uma crew fique sem líder.
     */
    countHoldersOfRole(roleId: string, scope: AuthorizationScope) {
        return this.database.userRole.count({
            where: {
                roleId,
                crewId: scope.crewId ?? null,
                serverId: scope.serverId ?? null,
                is_deleted: false,
            },
        });
    }

    findScopedRoleIds(userId: string, scope: AuthorizationScope) {
        return this.database.userRole.findMany({
            where: {
                userId,
                crewId: scope.crewId ?? null,
                serverId: scope.serverId ?? null,
                is_deleted: false,
            },
            select: { roleId: true, role: { select: { slug: true } } },
        });
    }
}
