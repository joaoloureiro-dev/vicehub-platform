import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRepository } from '../../src/modules/users/repositories/user.repository.js';
import type { DatabaseClient } from '@vicehub/database';

/**
 * Testes à forma das consultas do repositório de utilizadores.
 */
describe('UserRepository', () => {
    let database: {
        user: {
            findFirst: ReturnType<typeof vi.fn>;
            update: ReturnType<typeof vi.fn>;
        };
    };
    let repository: UserRepository;

    beforeEach(() => {
        database = { user: { findFirst: vi.fn(), update: vi.fn() } };
        repository = new UserRepository(database as unknown as DatabaseClient);
    });

    const argsOf = (mock: ReturnType<typeof vi.fn>): Record<string, unknown> =>
        (mock.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;

    describe('procura', () => {
        it('por username, ignorando contas eliminadas', () => {
            repository.findByUsername('player');

            /**
             * Uma conta eliminada por soft delete deixou de existir para
             * quem consulta. Sem este filtro, o perfil continuaria
             * publicamente acessível.
             */
            expect(argsOf(database.user.findFirst)['where']).toEqual({
                username: 'player',
                is_deleted: false,
            });
        });

        it('por id, ignorando contas eliminadas', () => {
            repository.findById('user-1');

            expect(argsOf(database.user.findFirst)['where']).toEqual({
                id: 'user-1',
                is_deleted: false,
            });
        });
    });

    describe('alteração do perfil', () => {
        const dataOf = (): Record<string, unknown> =>
            (argsOf(database.user.update)['data'] ?? {}) as Record<string, unknown>;

        it('omite os campos não indicados em vez de os apagar', () => {
            repository.updateProfile('user-1', { bio: 'nova bio' });

            /**
             * Não indicar o avatar tem de o deixar como está. Passá-lo
             * como undefined apagá-lo-ia por descuido.
             */
            expect(dataOf()).not.toHaveProperty('avatarUrl');
            expect(dataOf()['bio']).toBe('nova bio');
        });

        it('deixa limpar um campo explicitamente com null', () => {
            repository.updateProfile('user-1', { bio: null });

            expect(dataOf()['bio']).toBeNull();
        });

        it('incrementa a versão do registo', () => {
            repository.updateProfile('user-1', { bio: 'x' });

            expect(dataOf()['version']).toEqual({ increment: 1 });
        });

        it('nunca toca em identidade nem em campos de segurança', () => {
            repository.updateProfile('user-1', { bio: 'x', avatarUrl: 'https://a/b.png' });

            for (const campo of ['email', 'username', 'token_version', 'is_deleted']) {
                expect(dataOf()).not.toHaveProperty(campo);
            }
        });
    });
});
