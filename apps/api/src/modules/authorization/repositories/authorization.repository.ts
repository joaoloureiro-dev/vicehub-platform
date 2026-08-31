import type { DatabaseClient } from '@vicehub/database';

import type { AuthorizationScope } from '../types/authorization.types.js';

/**
 * Repositório do módulo de autorização.
 *
 * É a única camada que fala com a base de dados dentro do módulo.
 */
export class AuthorizationRepository {
    constructor(private readonly database: DatabaseClient) { }

    /**
     * Lê as permissões atribuídas a um utilizador no âmbito indicado.
     *
     * São considerados os cargos globais e, quando o âmbito o indicar,
     * os cargos atribuídos a essa crew ou a esse servidor. Um cargo de
     * outra crew nunca conta para a crew em causa.
     *
     * Atribuições expiradas ou eliminadas são ignoradas, tal como cargos
     * e permissões eliminados por soft delete.
     */
    findGrantedPermissions(userId: string, scope: AuthorizationScope) {
        const now = new Date();

        /**
         * Cargos globais: sem crew nem servidor associados.
         */
        const scopeConditions: {
            crewId: string | null;
            serverId: string | null;
        }[] = [{ crewId: null, serverId: null }];

        if (scope.crewId !== undefined) {
            scopeConditions.push({ crewId: scope.crewId, serverId: null });
        }

        if (scope.serverId !== undefined) {
            scopeConditions.push({ crewId: null, serverId: scope.serverId });
        }

        return this.database.userRole.findMany({
            where: {
                userId,
                is_deleted: false,
                OR: scopeConditions,
                AND: [
                    {
                        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
                    },
                ],
                role: {
                    is_deleted: false,
                },
            },
            select: {
                role: {
                    select: {
                        slug: true,
                        scope: true,
                        rolePermissions: {
                            where: {
                                is_deleted: false,
                                permission: {
                                    is_deleted: false,
                                },
                            },
                            select: {
                                permission: {
                                    select: {
                                        slug: true,
                                        scope: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
    }
}
