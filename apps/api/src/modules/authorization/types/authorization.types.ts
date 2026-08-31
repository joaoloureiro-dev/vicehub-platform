/**
 * Âmbito em que uma autorização é avaliada.
 *
 * Um cargo pode ser global ou estar limitado a uma crew ou a um
 * servidor. Sem âmbito, apenas os cargos globais contam.
 */
export interface AuthorizationScope {
    crewId?: string | undefined;
    serverId?: string | undefined;
}

/**
 * Permissões efetivas de um utilizador num determinado âmbito.
 */
export interface EffectivePermissions {
    userId: string;
    scope: AuthorizationScope;
    permissions: ReadonlySet<string>;
}
