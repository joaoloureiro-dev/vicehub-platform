import {
    DEFAULT_USER_ROLE,
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

        /**
         * Gerir membros e mandar na entidade são poderes diferentes, e o
         * catálogo tem de os manter separados: quem apenas aceita e
         * remove membros não pode ficar com a chave que permite alterar
         * cargos, ou promoveria um cúmplice e tomaria a crew ou o
         * servidor a quem o criou.
         */
        it('só um cargo por âmbito manda na própria entidade', () => {
            const holdersOf = (permission: PermissionKey): RoleKey[] =>
                ROLE_KEYS.filter((key) =>
                    (ROLES[key].permissions as readonly PermissionKey[]).includes(
                        permission,
                    ),
                );

            expect(holdersOf('crew:manage')).toEqual(['crew_leader']);
            expect(holdersOf('server:manage')).toEqual(['server_owner']);
        });

        it('gerir membros não arrasta consigo o poder de gerir a entidade', () => {
            const temGestaoDeMembrosSemMandar = ROLE_KEYS.filter((key) => {
                const permissions = ROLES[key].permissions as readonly PermissionKey[];

                return (
                    (permissions.includes('crew:manage_members') &&
                        !permissions.includes('crew:manage')) ||
                    (permissions.includes('server:manage_members') &&
                        !permissions.includes('server:manage'))
                );
            });

            /**
             * Estes são exatamente os cargos intermédios. O teste existe
             * para que a distinção seja deliberada e não um acaso.
             */
            expect(temGestaoDeMembrosSemMandar).toEqual([
                'crew_officer',
                'server_moderator',
            ]);
        });

        /**
         * Propor uma despesa e autorizá-la são atos diferentes, e é essa
         * separação que torna a aprovação uma aprovação: se quem propõe
         * também decide, a tesouraria não tem controlo nenhum.
         */
        it('quem aprova despesas é sempre menos do que quem as propõe', () => {
            const holdersOf = (permission: PermissionKey): RoleKey[] =>
                ROLE_KEYS.filter((key) =>
                    (ROLES[key].permissions as readonly PermissionKey[]).includes(
                        permission,
                    ),
                );

            const propoem = holdersOf('treasury:transfer');
            const aprovam = holdersOf('treasury:approve');

            expect(aprovam.length).toBeLessThan(propoem.length);

            for (const cargo of aprovam) {
                expect(propoem, `${cargo} aprova mas não propõe`).toContain(cargo);
            }
        });

        it('só quem manda na entidade aprova a sua tesouraria', () => {
            const aprovam = ROLE_KEYS.filter((key) =>
                (ROLES[key].permissions as readonly PermissionKey[]).includes(
                    'treasury:approve',
                ),
            );

            expect(aprovam).toEqual(['crew_leader', 'server_owner']);
        });

        /**
         * Ver a tesouraria é o mínimo para quem lhe mexe. Um cargo que
         * pudesse movimentar sem ver estaria a agir às cegas.
         */
        it('quem mexe na tesouraria consegue vê-la', () => {
            for (const key of ROLE_KEYS) {
                const permissions = ROLES[key].permissions as readonly PermissionKey[];

                if (
                    permissions.includes('treasury:transfer') ||
                    permissions.includes('treasury:approve')
                ) {
                    expect(permissions, `cargo ${key}`).toContain('treasury:read');
                }
            }
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

describe('cargo base do registo', () => {
    it('existe no catálogo', () => {
        expect(ROLES[DEFAULT_USER_ROLE]).toBeDefined();
    });

    it('é global, para valer em qualquer contexto', () => {
        /**
         * Um cargo de crew ou de servidor só valeria dentro desse
         * âmbito, deixando o utilizador sem nada fora dele.
         */
        expect(ROLES[DEFAULT_USER_ROLE].scope).toBe('global');
    });

    it('não concede poderes de gestão nem de administração', () => {
        const permissions: readonly PermissionKey[] = ROLES[DEFAULT_USER_ROLE].permissions;

        expect(permissions).not.toContain(SYSTEM_MANAGE_PERMISSION);
        expect(
            permissions.filter((permission) => permission.endsWith(':manage')),
        ).toEqual([]);
    });

    it('concede alguma leitura, senão não valeria a pena atribuí-lo', () => {
        const permissions: readonly PermissionKey[] = ROLES[DEFAULT_USER_ROLE].permissions;

        expect(
            permissions.some((permission) => permission.endsWith(':read')),
        ).toBe(true);
    });
});
