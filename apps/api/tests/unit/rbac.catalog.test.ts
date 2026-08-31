import {
    PERMISSIONS,
    PERMISSION_KEYS,
    ROLES,
    ROLE_KEYS,
    SYSTEM_MANAGE_PERMISSION,
    buildPermissionKey,
    type PermissionKey,
    type RoleKey,
} from '@vicehub/database';
import { describe, expect, it } from 'vitest';

/**
 * Testes ao catálogo de cargos e permissões.
 *
 * O catálogo alimenta o seed da base de dados e é o que o código usa
 * para exigir permissões. Uma incoerência aqui traduz-se em pedidos
 * recusados sem razão aparente, ou em cargos que na prática não
 * concedem nada.
 */
describe('catálogo de RBAC', () => {
    describe('permissões', () => {
        it('a chave corresponde sempre ao escopo e slug guardados', () => {
            for (const key of PERMISSION_KEYS) {
                const definition = PERMISSIONS[key];

                /**
                 * A chave é o que o código escreve; o par escopo e slug é
                 * o que fica na base de dados. Se divergirem, a comparação
                 * em runtime nunca encontra a permissão.
                 */
                expect(buildPermissionKey(definition.scope, definition.slug)).toBe(key);
            }
        });

        it('não existem permissões repetidas', () => {
            const stored = PERMISSION_KEYS.map((key) =>
                buildPermissionKey(PERMISSIONS[key].scope, PERMISSIONS[key].slug),
            );

            expect(new Set(stored).size).toBe(stored.length);
        });

        it('todas têm nome e descrição preenchidos', () => {
            for (const key of PERMISSION_KEYS) {
                expect(PERMISSIONS[key].name.length).toBeGreaterThan(0);
                expect(PERMISSIONS[key].description.length).toBeGreaterThan(0);
            }
        });

        it('a permissão de administração existe no catálogo', () => {
            expect(PERMISSIONS[SYSTEM_MANAGE_PERMISSION]).toBeDefined();
        });
    });

    describe('cargos', () => {
        it('só referem permissões que existem', () => {
            for (const key of ROLE_KEYS) {
                for (const permission of ROLES[key].permissions) {
                    expect(
                        PERMISSIONS[permission],
                        `o cargo ${key} refere ${permission}`,
                    ).toBeDefined();
                }
            }
        });

        it('nenhum cargo fica sem permissões', () => {
            for (const key of ROLE_KEYS) {
                expect(ROLES[key].permissions.length, `cargo ${key}`).toBeGreaterThan(0);
            }
        });

        it('não repetem a mesma permissão', () => {
            for (const key of ROLE_KEYS) {
                const permissions = ROLES[key].permissions;

                expect(new Set(permissions).size, `cargo ${key}`).toBe(
                    permissions.length,
                );
            }
        });

        it('não existem slugs repetidos dentro do mesmo escopo', () => {
            const pairs = ROLE_KEYS.map((key) => `${ROLES[key].scope}:${ROLES[key].slug}`);

            expect(new Set(pairs).size).toBe(pairs.length);
        });

        it('só o administrador tem a permissão de administração', () => {
            const permissionsOf = (key: RoleKey): readonly PermissionKey[] =>
                ROLES[key].permissions;

            const holders = ROLE_KEYS.filter((key) =>
                permissionsOf(key).includes(SYSTEM_MANAGE_PERMISSION),
            );

            /**
             * Esta permissão cobre todas as outras. Espalhá-la por vários
             * cargos daria acesso total sem que isso fosse evidente ao
             * ler o catálogo.
             */
            expect(holders).toEqual(['admin']);
        });

        it('cargos de crew não concedem permissões de servidor, e vice-versa', () => {
            for (const key of ROLE_KEYS) {
                const role = ROLES[key];

                if (role.scope === 'crew') {
                    expect(
                        role.permissions.some((permission) =>
                            permission.startsWith('server:'),
                        ),
                        `cargo ${key}`,
                    ).toBe(false);
                }

                if (role.scope === 'server') {
                    expect(
                        role.permissions.some((permission) =>
                            permission.startsWith('crew:'),
                        ),
                        `cargo ${key}`,
                    ).toBe(false);
                }
            }
        });
    });
});
