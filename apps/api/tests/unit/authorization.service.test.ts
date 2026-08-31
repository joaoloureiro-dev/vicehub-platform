import { PermissionScope } from '@vicehub/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorizationError } from '../../src/modules/authorization/errors/authorization.errors.js';
import { AuthorizationService } from '../../src/modules/authorization/services/authorization.service.js';
import type { AuthorizationRepository } from '../../src/modules/authorization/repositories/authorization.repository.js';

/**
 * Constrói o resultado do repositório: cargos, cada um com as suas
 * permissões, tal como saem da consulta.
 */
const grants = (...roles: { scope: PermissionScope; slug: string }[][]) =>
    roles.map((permissions) => ({
        role: {
            slug: 'cargo',
            scope: 'global',
            rolePermissions: permissions.map((permission) => ({ permission })),
        },
    }));

const permission = (scope: PermissionScope, slug: string) => ({ scope, slug });

describe('AuthorizationService', () => {
    let repository: { findGrantedPermissions: ReturnType<typeof vi.fn> };
    let service: AuthorizationService;

    beforeEach(() => {
        repository = { findGrantedPermissions: vi.fn() };
        service = new AuthorizationService(
            repository as unknown as AuthorizationRepository,
        );
    });

    const effectiveFor = async (
        granted: ReturnType<typeof grants>,
        scope = {},
    ) => {
        repository.findGrantedPermissions.mockResolvedValue(granted);

        return service.getEffectivePermissions('user-1', scope);
    };

    describe('reunião de permissões', () => {
        it('acumula as permissões de vários cargos', async () => {
            const effective = await effectiveFor(
                grants(
                    [permission(PermissionScope.crew, 'read')],
                    [permission(PermissionScope.treasury, 'read')],
                ),
            );

            expect([...effective.permissions].sort()).toEqual([
                'crew:read',
                'treasury:read',
            ]);
        });

        it('não duplica uma permissão concedida por dois cargos', async () => {
            const effective = await effectiveFor(
                grants(
                    [permission(PermissionScope.crew, 'read')],
                    [permission(PermissionScope.crew, 'read')],
                ),
            );

            expect(effective.permissions.size).toBe(1);
        });

        it('um utilizador sem cargos fica sem permissões', async () => {
            const effective = await effectiveFor([]);

            expect(effective.permissions.size).toBe(0);
        });

        it('mantém o âmbito em que foram avaliadas', async () => {
            const effective = await effectiveFor([], { crewId: 'crew-1' });

            expect(effective.scope).toEqual({ crewId: 'crew-1' });
        });
    });

    describe('verificação', () => {
        it('autoriza quando todas as permissões exigidas estão presentes', async () => {
            const effective = await effectiveFor(
                grants([
                    permission(PermissionScope.crew, 'read'),
                    permission(PermissionScope.crew, 'manage'),
                ]),
            );

            expect(service.hasPermissions(effective, ['crew:read', 'crew:manage'])).toBe(
                true,
            );
        });

        it('recusa quando falta uma das exigidas', async () => {
            const effective = await effectiveFor(
                grants([permission(PermissionScope.crew, 'read')]),
            );

            /**
             * As permissões exigidas são conjuntivas: ter uma não basta
             * quando a rota pede duas.
             */
            expect(service.hasPermissions(effective, ['crew:read', 'crew:manage'])).toBe(
                false,
            );
        });

        it('não confunde permissões com o mesmo slug em escopos diferentes', async () => {
            const effective = await effectiveFor(
                grants([permission(PermissionScope.crew, 'read')]),
            );

            expect(service.hasPermissions(effective, ['server:read'])).toBe(false);
        });

        it('diz exatamente quais as permissões em falta', async () => {
            const effective = await effectiveFor(
                grants([permission(PermissionScope.crew, 'read')]),
            );

            expect(
                service.findMissingPermissions(effective, [
                    'crew:read',
                    'crew:manage',
                    'treasury:transfer',
                ]),
            ).toEqual(['crew:manage', 'treasury:transfer']);
        });

        it('nada exigido é sempre autorizado', async () => {
            const effective = await effectiveFor([]);

            expect(service.hasPermissions(effective, [])).toBe(true);
        });
    });

    describe('administração da plataforma', () => {
        it('system:manage cobre qualquer permissão', async () => {
            const effective = await effectiveFor(
                grants([permission(PermissionScope.system, 'manage')]),
            );

            /**
             * Sem isto, cada permissão nova exigiria rever o cargo de
             * administrador para que continuasse a poder operar.
             */
            expect(
                service.hasPermissions(effective, [
                    'user:delete',
                    'treasury:transfer',
                    'crew:manage',
                ]),
            ).toBe(true);
        });
    });

    describe('assertPermissions', () => {
        it('deixa passar quando está autorizado', async () => {
            const effective = await effectiveFor(
                grants([permission(PermissionScope.crew, 'read')]),
            );

            expect(() => service.assertPermissions(effective, ['crew:read'])).not.toThrow();
        });

        it('lança um erro de autorização com as permissões em falta', async () => {
            const effective = await effectiveFor([]);

            try {
                service.assertPermissions(effective, ['crew:manage']);
                expect.unreachable('devia ter lançado');
            } catch (error: unknown) {
                expect(error).toBeInstanceOf(AuthorizationError);
                expect((error as AuthorizationError).code).toBe(
                    'INSUFFICIENT_PERMISSIONS',
                );
                expect((error as AuthorizationError).missingPermissions).toEqual([
                    'crew:manage',
                ]);
            }
        });
    });
});
