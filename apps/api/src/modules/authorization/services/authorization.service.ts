import {
    PERMISSIONS,
    SYSTEM_MANAGE_PERMISSION,
    buildPermissionKey,
    type PermissionKey,
} from '@vicehub/database';

import { AuthorizationError } from '../errors/authorization.errors.js';
import type { AuthorizationRepository } from '../repositories/authorization.repository.js';
import type {
    AuthorizationScope,
    EffectivePermissions,
} from '../types/authorization.types.js';

/**
 * Chave gravada da permissão de administração total.
 */
const SYSTEM_MANAGE_KEY = buildPermissionKey(
    PERMISSIONS[SYSTEM_MANAGE_PERMISSION].scope,
    PERMISSIONS[SYSTEM_MANAGE_PERMISSION].slug,
);

/**
 * Serviço de autorização.
 *
 * Responde a uma única pergunta: este utilizador pode fazer isto, neste
 * âmbito? Não sabe nada de HTTP e não fala diretamente com o Prisma.
 */
export class AuthorizationService {
    constructor(
        private readonly authorizationRepository: AuthorizationRepository,
    ) { }

    /**
     * Reúne as permissões efetivas de um utilizador.
     *
     * As permissões dos vários cargos são acumuladas: ter um cargo que
     * não concede uma permissão nunca retira o que outro concede.
     */
    async getEffectivePermissions(
        userId: string,
        scope: AuthorizationScope = {},
    ): Promise<EffectivePermissions> {
        const assignments =
            await this.authorizationRepository.findGrantedPermissions(userId, scope);

        const permissions = new Set<string>();

        for (const assignment of assignments) {
            for (const rolePermission of assignment.role.rolePermissions) {
                permissions.add(
                    buildPermissionKey(
                        rolePermission.permission.scope,
                        rolePermission.permission.slug,
                    ),
                );
            }
        }

        return { userId, scope, permissions };
    }

    /**
     * Indica se as permissões reunidas cobrem todas as exigidas.
     *
     * A permissão de administração da plataforma cobre tudo. Sem ela,
     * cada nova permissão obrigaria a rever manualmente o cargo de
     * administrador para que continuasse a poder operar.
     */
    hasPermissions(
        effective: EffectivePermissions,
        required: readonly PermissionKey[],
    ): boolean {
        return this.findMissingPermissions(effective, required).length === 0;
    }

    /**
     * Devolve as permissões em falta, para que a recusa possa dizer
     * exatamente o que faltava em vez de um não genérico.
     */
    findMissingPermissions(
        effective: EffectivePermissions,
        required: readonly PermissionKey[],
    ): PermissionKey[] {
        if (effective.permissions.has(SYSTEM_MANAGE_KEY)) {
            return [];
        }

        return required.filter((permission) => {
            const definition = PERMISSIONS[permission];

            return !effective.permissions.has(
                buildPermissionKey(definition.scope, definition.slug),
            );
        });
    }

    /**
     * Recusa a operação quando falta alguma permissão.
     */
    assertPermissions(
        effective: EffectivePermissions,
        required: readonly PermissionKey[],
    ): void {
        const missing = this.findMissingPermissions(effective, required);

        if (missing.length === 0) {
            return;
        }

        throw new AuthorizationError(
            'INSUFFICIENT_PERMISSIONS',
            'Não tens autorização para executar esta operação.',
            missing,
        );
    }
}
