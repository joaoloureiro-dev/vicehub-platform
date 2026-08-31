import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthError, type AuthErrorCode } from '../../src/modules/auth/errors/auth.errors.js';
import { AuthService } from '../../src/modules/auth/services/auth.service.js';
import type { TokenService } from '../../src/modules/auth/services/token.service.js';
import {
    asAuthRepository,
    asPasswordService,
    buildRefreshTokenRow,
    buildSessionWithUser,
    buildUserRow,
    buildUserWithCredentials,
    createAuthRepositoryMock,
    createPasswordServiceMock,
    createTokenService,
    type AuthRepositoryMock,
} from '../helpers/auth.fixtures.js';

describe('AuthService', () => {
    let repository: AuthRepositoryMock;
    let passwordService: ReturnType<typeof createPasswordServiceMock>;
    let tokenService: TokenService;
    let service: AuthService;

    /**
     * O hash Argon2 é calculado uma única vez: repeti-lo em cada teste
     * tornaria a suite desnecessariamente lenta.
     */
    let secret: string;
    let secretHash: string;
    let validRefreshToken: string;

    beforeAll(async () => {
        const service = createTokenService();

        secret = service.generateRefreshTokenSecret();
        secretHash = await service.hashRefreshTokenSecret(secret);
        validRefreshToken = service.buildRefreshToken('refresh-1', secret);
    });

    beforeEach(() => {
        repository = createAuthRepositoryMock();
        passwordService = createPasswordServiceMock();
        tokenService = createTokenService();

        service = new AuthService(
            asAuthRepository(repository),
            asPasswordService(passwordService),
            tokenService,
        );

        repository.createSession.mockResolvedValue({ id: 'session-1' });
        repository.createRefreshToken.mockResolvedValue({ id: 'refresh-2' });
        repository.updateLastLogin.mockResolvedValue(undefined);
        repository.touchSession.mockResolvedValue(undefined);
        repository.markRefreshTokenAsUsed.mockResolvedValue(undefined);
        repository.rotateRefreshToken.mockResolvedValue(undefined);
        repository.revokeSessionWithRefreshTokens.mockResolvedValue(undefined);
        repository.incrementUserTokenVersion.mockResolvedValue(undefined);
        repository.revokeAllUserSessions.mockResolvedValue(undefined);
    });

    const expectAuthError = async (
        promise: Promise<unknown>,
        code: AuthErrorCode,
    ) => {
        const error = await promise.catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe(code);
    };

    describe('register', () => {
        it('recusa um email já registado', async () => {
            repository.findUserByEmail.mockResolvedValue(buildUserWithCredentials());

            await expectAuthError(
                service.register({
                    email: 'player@vicehub.com',
                    username: 'player',
                    password: 'password-forte-123',
                }),
                'EMAIL_ALREADY_EXISTS',
            );

            expect(repository.createLocalUser).not.toHaveBeenCalled();
        });

        it('guarda o hash da password e nunca a password', async () => {
            repository.findUserByEmail.mockResolvedValue(null);
            repository.createLocalUser.mockResolvedValue(buildUserRow());

            const result = await service.register({
                email: 'player@vicehub.com',
                username: 'player',
                password: 'password-forte-123',
            });

            expect(passwordService.hash).toHaveBeenCalledWith('password-forte-123');
            expect(repository.createLocalUser).toHaveBeenCalledWith(
                expect.objectContaining({ passwordHash: 'hash-argon2' }),
            );

            /**
             * Nenhuma chamada ao repositório pode transportar a password
             * em texto simples, nem sequer aninhada num objeto.
             */
            expect(JSON.stringify(repository.createLocalUser.mock.calls)).not.toContain(
                'password-forte-123',
            );

            expect(result.accessToken).toBe('access-token-assinado');
            expect(result.refreshToken).toContain('refresh-2.');
        });
    });

    describe('login', () => {
        const credentials = {
            email: 'player@vicehub.com',
            password: 'password-forte-123',
        };

        it('devolve o mesmo erro quando o email não existe', async () => {
            repository.findUserByEmail.mockResolvedValue(null);

            await expectAuthError(service.login(credentials), 'INVALID_CREDENTIALS');
        });

        it('consome o custo de uma verificação mesmo sem utilizador', async () => {
            repository.findUserByEmail.mockResolvedValue(null);

            await service.login(credentials).catch(() => undefined);

            expect(passwordService.simulateVerification).toHaveBeenCalledOnce();
        });

        it('recusa credenciais eliminadas por soft delete', async () => {
            repository.findUserByEmail.mockResolvedValue(
                buildUserWithCredentials({ credentialsDeleted: true }),
            );

            await expectAuthError(service.login(credentials), 'INVALID_CREDENTIALS');
            expect(passwordService.verify).not.toHaveBeenCalled();
        });

        it('recusa uma password errada', async () => {
            repository.findUserByEmail.mockResolvedValue(buildUserWithCredentials());
            passwordService.verify.mockResolvedValue(false);

            await expectAuthError(service.login(credentials), 'INVALID_CREDENTIALS');
            expect(repository.createSession).not.toHaveBeenCalled();
        });

        it('cria sessão e emite tokens quando a password está correta', async () => {
            repository.findUserByEmail.mockResolvedValue(buildUserWithCredentials());

            const result = await service.login({
                ...credentials,
                ipAddress: '203.0.113.10',
                userAgent: 'ViceHub/1.0',
            });

            expect(repository.updateLastLogin).toHaveBeenCalledOnce();
            expect(repository.createSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user-1',
                    ipAddress: '203.0.113.10',
                    userAgent: 'ViceHub/1.0',
                }),
            );
            expect(result.user.email).toBe('player@vicehub.com');
        });

        it('omite metadados ausentes em vez de os enviar como undefined', async () => {
            repository.findUserByEmail.mockResolvedValue(buildUserWithCredentials());

            await service.login(credentials);

            const sessionInput = repository.createSession.mock.calls[0]?.[0] as
                | Record<string, unknown>
                | undefined;

            expect(Object.keys(sessionInput ?? {})).toEqual(['userId', 'expiresAt']);
        });
    });

    describe('refresh', () => {
        it('rejeita um token com formato inválido', async () => {
            await expectAuthError(service.refresh('sem-separador'), 'INVALID_REFRESH_TOKEN');
            expect(repository.findRefreshTokenById).not.toHaveBeenCalled();
        });

        it('rejeita um identificador desconhecido', async () => {
            repository.findRefreshTokenById.mockResolvedValue(null);

            await expectAuthError(service.refresh(validRefreshToken), 'INVALID_REFRESH_TOKEN');
        });

        it('não revoga a sessão quando o segredo não confere', async () => {
            repository.findRefreshTokenById.mockResolvedValue(
                buildRefreshTokenRow({ tokenHash: secretHash, status: 'rotated' }),
            );

            const forged = tokenService.buildRefreshToken(
                'refresh-1',
                tokenService.generateRefreshTokenSecret(),
            );

            await expectAuthError(service.refresh(forged), 'INVALID_REFRESH_TOKEN');

            /**
             * Sem esta garantia bastaria adivinhar um identificador para
             * terminar a sessão de outro utilizador.
             */
            expect(repository.revokeSessionWithRefreshTokens).not.toHaveBeenCalled();
        });

        it.each(['rotated', 'revoked'] as const)(
            'revoga a família inteira quando um token %s é reutilizado',
            async (status) => {
                repository.findRefreshTokenById.mockResolvedValue(
                    buildRefreshTokenRow({ tokenHash: secretHash, status }),
                );

                await expectAuthError(
                    service.refresh(validRefreshToken),
                    'REFRESH_TOKEN_REUSED',
                );

                expect(repository.revokeSessionWithRefreshTokens).toHaveBeenCalledWith(
                    'session-1',
                    expect.any(Date),
                );
            },
        );

        it('rejeita um token expirado sem revogar a família', async () => {
            repository.findRefreshTokenById.mockResolvedValue(
                buildRefreshTokenRow({
                    tokenHash: secretHash,
                    expiresAt: new Date(Date.now() - 1_000),
                }),
            );

            await expectAuthError(service.refresh(validRefreshToken), 'INVALID_REFRESH_TOKEN');
            expect(repository.revokeSessionWithRefreshTokens).not.toHaveBeenCalled();
        });

        it('rejeita quando a sessão associada já não está ativa', async () => {
            repository.findRefreshTokenById.mockResolvedValue(
                buildRefreshTokenRow({ tokenHash: secretHash }),
            );
            repository.findActiveSessionWithUser.mockResolvedValue(null);

            await expectAuthError(service.refresh(validRefreshToken), 'INVALID_REFRESH_TOKEN');
        });

        it('roda o token antigo para o novo e mantém a sessão', async () => {
            repository.findRefreshTokenById.mockResolvedValue(
                buildRefreshTokenRow({ tokenHash: secretHash }),
            );
            repository.findActiveSessionWithUser.mockResolvedValue(buildSessionWithUser());

            const result = await service.refresh(validRefreshToken);

            expect(repository.markRefreshTokenAsUsed).toHaveBeenCalledWith(
                'refresh-1',
                expect.any(Date),
            );
            expect(repository.touchSession).toHaveBeenCalledOnce();
            expect(repository.rotateRefreshToken).toHaveBeenCalledWith({
                currentRefreshTokenId: 'refresh-1',
                replacementRefreshTokenId: 'refresh-2',
            });

            expect(result.refreshToken).not.toBe(validRefreshToken);
            expect(repository.createSession).not.toHaveBeenCalled();
        });
    });

    describe('logout', () => {
        it('revoga a sessão e os seus refresh tokens numa só operação', async () => {
            await service.logout({ sessionId: 'session-1' });

            expect(repository.revokeSessionWithRefreshTokens).toHaveBeenCalledWith(
                'session-1',
                expect.any(Date),
            );
        });
    });

    describe('logoutAll', () => {
        it('incrementa a tokenVersion e revoga todas as sessões', async () => {
            await service.logoutAll({ userId: 'user-1' });

            expect(repository.incrementUserTokenVersion).toHaveBeenCalledWith('user-1');
            expect(repository.revokeAllUserSessions).toHaveBeenCalledWith(
                'user-1',
                expect.any(Date),
            );
        });
    });
});
