import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthRepository } from '../../src/modules/auth/repositories/auth.repository.js';
import type { DatabaseClient } from '@vicehub/database';

/**
 * Testes à forma das consultas do repositório.
 *
 * Os testes do AuthService substituem o repositório por duplos, pelo que
 * nada verifica o que é realmente pedido à base de dados. Um filtro que
 * desaparecesse aqui passaria despercebido em toda a restante suite.
 */
describe('AuthRepository', () => {
    let database: {
        user: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
        userCredential: { update: ReturnType<typeof vi.fn> };
        authSession: {
            findFirst: ReturnType<typeof vi.fn>;
            update: ReturnType<typeof vi.fn>;
            updateMany: ReturnType<typeof vi.fn>;
        };
        refreshToken: {
            findUnique: ReturnType<typeof vi.fn>;
            updateMany: ReturnType<typeof vi.fn>;
        };
        $transaction: ReturnType<typeof vi.fn>;
    };
    let repository: AuthRepository;

    const argsOf = (mock: ReturnType<typeof vi.fn>): Record<string, unknown> =>
        (mock.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;

    beforeEach(() => {
        database = {
            user: { findFirst: vi.fn(), update: vi.fn() },
            userCredential: { update: vi.fn() },
            authSession: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
            refreshToken: { findUnique: vi.fn(), updateMany: vi.fn() },
            $transaction: vi.fn(),
        };

        repository = new AuthRepository(database as unknown as DatabaseClient);
    });

    describe('findExistingIdentity', () => {
        it('procura por email e por username', () => {
            repository.findExistingIdentity('player@vicehub.com', 'player');

            expect(argsOf(database.user.findFirst)['where']).toMatchObject({
                is_deleted: false,
                OR: [{ email: 'player@vicehub.com' }, { username: 'player' }],
            });
        });

        it('não traz mais dados do que os necessários', () => {
            repository.findExistingIdentity('player@vicehub.com', 'player');

            expect(argsOf(database.user.findFirst)['select']).toEqual({
                email: true,
                username: true,
            });
        });
    });

    describe('findUserByEmail', () => {
        it('exclui utilizadores eliminados e traz as credenciais', () => {
            repository.findUserByEmail('player@vicehub.com');

            const args = argsOf(database.user.findFirst);

            expect(args['where']).toMatchObject({
                email: 'player@vicehub.com',
                is_deleted: false,
            });
            expect(args['include']).toEqual({ credentials: true });
        });
    });

    describe('findActiveSessionWithUser', () => {
        it('exige sessão ativa, não eliminada e ainda dentro da validade', () => {
            repository.findActiveSessionWithUser('session-1');

            const where = argsOf(database.authSession.findFirst)['where'] as Record<
                string,
                unknown
            >;

            expect(where['id']).toBe('session-1');
            expect(where['status']).toBe('active');
            expect(where['is_deleted']).toBe(false);
            expect(where['expires_at']).toMatchObject({ gt: expect.any(Date) });
        });
    });

    describe('registerFailedLoginAttempt', () => {
        it('usa incremento atómico e não um valor calculado em memória', () => {
            repository.registerFailedLoginAttempt('credential-1');

            const data = argsOf(database.userCredential.update)['data'] as Record<
                string,
                unknown
            >;

            /**
             * Ler e voltar a escrever perderia contagens em tentativas
             * concorrentes. O incremento tem de ser feito pela base de dados.
             */
            expect(data['failed_login_attempts']).toEqual({ increment: 1 });
        });
    });

    describe('lockCredential', () => {
        it('repõe o contador ao bloquear', () => {
            const lockedUntil = new Date();

            repository.lockCredential('credential-1', lockedUntil);

            expect(argsOf(database.userCredential.update)['data']).toMatchObject({
                locked_until: lockedUntil,
                failed_login_attempts: 0,
            });
        });
    });

    describe('revokeSessionWithRefreshTokens', () => {
        it('revoga tokens e sessão na mesma transação', () => {
            repository.revokeSessionWithRefreshTokens('session-1', new Date());

            expect(database.$transaction).toHaveBeenCalledOnce();

            const operations = database.$transaction.mock.calls[0]?.[0];

            expect(Array.isArray(operations)).toBe(true);
            expect(operations).toHaveLength(2);
            expect(database.refreshToken.updateMany).toHaveBeenCalledOnce();
            expect(database.authSession.update).toHaveBeenCalledOnce();
        });
    });
});
