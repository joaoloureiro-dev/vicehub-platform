import { vi } from 'vitest';

import type { AuthRepository } from '../../src/modules/auth/repositories/auth.repository.js';
import type { PasswordService } from '../../src/modules/auth/services/password.service.js';
import { TokenService } from '../../src/modules/auth/services/token.service.js';

/**
 * Duplo de teste do AuthRepository.
 *
 * O repositório devolve tipos gerados pelo Prisma, demasiado extensos
 * para reproduzir num teste. Como o AuthService só lê um punhado de
 * campos, construímos objetos com esses campos e convertemos o duplo
 * para o tipo do repositório num único ponto controlado.
 */
export type AuthRepositoryMock = ReturnType<typeof createAuthRepositoryMock>;

export const createAuthRepositoryMock = () => ({
    findUserByEmail: vi.fn(),
    findUserById: vi.fn(),
    createLocalUser: vi.fn(),
    updateLastLogin: vi.fn(),
    registerFailedLoginAttempt: vi.fn(),
    lockCredential: vi.fn(),
    clearFailedLoginAttempts: vi.fn(),
    createSession: vi.fn(),
    findActiveSession: vi.fn(),
    findActiveSessionWithUser: vi.fn(),
    touchSession: vi.fn(),
    createRefreshToken: vi.fn(),
    findRefreshTokenById: vi.fn(),
    findActiveRefreshTokenById: vi.fn(),
    findActiveRefreshTokensBySession: vi.fn(),
    markRefreshTokenAsUsed: vi.fn(),
    rotateRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
    revokeSession: vi.fn(),
    revokeActiveRefreshTokensBySession: vi.fn(),
    revokeSessionWithRefreshTokens: vi.fn(),
    incrementUserTokenVersion: vi.fn(),
    revokeAllUserSessions: vi.fn(),
});

export const asAuthRepository = (mock: AuthRepositoryMock): AuthRepository =>
    mock as unknown as AuthRepository;

/**
 * Duplo do PasswordService.
 *
 * O Argon2 real é testado no seu próprio ficheiro. Aqui interessa
 * apenas o comportamento do AuthService perante um resultado.
 */
export const createPasswordServiceMock = () => ({
    hash: vi.fn().mockResolvedValue('hash-argon2'),
    verify: vi.fn().mockResolvedValue(true),
    simulateVerification: vi.fn().mockResolvedValue(undefined),
});

export const asPasswordService = (
    mock: ReturnType<typeof createPasswordServiceMock>,
): PasswordService => mock as unknown as PasswordService;

/**
 * TokenService real, com um duplo apenas para a assinatura JWT.
 *
 * Manter o serviço real garante que os testes exercitam mesmo o
 * formato do refresh token e o hash do segredo.
 */
export const createTokenService = (): TokenService => {
    const app = {
        jwt: {
            sign: vi.fn(() => 'access-token-assinado'),
        },
    };

    return new TokenService(app as never);
};

interface UserRowOverrides {
    id?: string;
    email?: string;
    username?: string;
    token_version?: number;
    is_deleted?: boolean;
}

export const buildUserRow = (overrides: UserRowOverrides = {}) => ({
    id: overrides.id ?? 'user-1',
    email: overrides.email ?? 'player@vicehub.com',
    username: overrides.username ?? 'player',
    token_version: overrides.token_version ?? 1,
    is_deleted: overrides.is_deleted ?? false,
});

interface CredentialOverrides {
    credentialsDeleted?: boolean;
    failedLoginAttempts?: number;
    lockedUntil?: Date | null;
}

export const buildUserWithCredentials = (
    overrides: UserRowOverrides & CredentialOverrides = {},
) => ({
    ...buildUserRow(overrides),
    credentials: {
        id: 'credential-1',
        password_hash: 'hash-argon2',
        is_deleted: overrides.credentialsDeleted ?? false,
        failed_login_attempts: overrides.failedLoginAttempts ?? 0,
        locked_until: overrides.lockedUntil ?? null,
    },
});

/**
 * Data no futuro, usada para simular uma conta ainda bloqueada.
 */
export const minutesFromNow = (minutes: number): Date =>
    new Date(Date.now() + minutes * 60_000);

export const buildSessionWithUser = (
    overrides: { sessionId?: string; user?: ReturnType<typeof buildUserRow> } = {},
) => ({
    id: overrides.sessionId ?? 'session-1',
    userId: (overrides.user ?? buildUserRow()).id,
    user: overrides.user ?? buildUserRow(),
});

interface RefreshTokenRowOverrides {
    id?: string;
    sessionId?: string;
    tokenHash: string;
    status?: 'active' | 'rotated' | 'revoked' | 'expired';
    isDeleted?: boolean;
    expiresAt?: Date;
}

export const buildRefreshTokenRow = (overrides: RefreshTokenRowOverrides) => ({
    id: overrides.id ?? 'refresh-1',
    sessionId: overrides.sessionId ?? 'session-1',
    token_hash: overrides.tokenHash,
    status: overrides.status ?? 'active',
    is_deleted: overrides.isDeleted ?? false,
    expires_at: overrides.expiresAt ?? new Date(Date.now() + 3_600_000),
});
