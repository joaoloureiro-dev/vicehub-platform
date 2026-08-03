import { env } from '../../../config/env.js';
import { AuthError } from '../errors/auth.errors.js';
import type { AuthRepository } from '../repositories/auth.repository.js';
import type { AccessTokenPayload } from '../types/auth.types.js';
import type { PasswordService } from './password.service.js';
import type { TokenService } from './token.service.js';

interface RegisterInput {
    email: string;
    username: string;
    password: string;
}

interface LoginInput {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
}

interface RefreshInput {
    refreshToken: string;
}

interface LogoutInput {
    sessionId: string;
    refreshTokenId?: string;
}

interface LogoutAllInput {
    userId: string;
}

interface AuthResult {
    accessToken: string;
    refreshToken: string;
}

interface CreateAuthenticatedSessionInput {
    userId: string;
    tokenVersion: number;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
}

interface CreateSessionRepositoryInput {
    userId: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
}

/**
 * Serviço principal de autenticação.
 *
 * Esta camada contém regras de negócio.
 *
 * Não fala diretamente com Prisma.
 * Não sabe detalhes HTTP.
 * Não lê nem escreve cookies.
 */
export class AuthService {
    constructor(
        private readonly authRepository: AuthRepository,
        private readonly passwordService: PasswordService,
        private readonly tokenService: TokenService,
    ) { }

    /**
     * Regista um novo utilizador local.
     */
    async register(input: RegisterInput): Promise<AuthResult> {
        const existingUser = await this.authRepository.findUserByEmail(input.email);

        if (existingUser) {
            throw new AuthError(
                'EMAIL_ALREADY_EXISTS',
                'Já existe uma conta com este email.',
            );
        }

        const passwordHash = await this.passwordService.hash(input.password);

        const user = await this.authRepository.createLocalUser({
            email: input.email,
            username: input.username,
            passwordHash,
        });

        return this.createAuthenticatedSession({
            userId: user.id,
            tokenVersion: user.token_version,
        });
    }

    /**
     * Login local com email e password.
     */
    async login(input: LoginInput): Promise<AuthResult> {
        const user = await this.authRepository.findUserByEmail(input.email);

        if (!user || !user.credentials) {
            throw new AuthError(
                'INVALID_CREDENTIALS',
                'Email ou password inválidos.',
            );
        }

        const passwordIsValid = await this.passwordService.verify(
            user.credentials.password_hash,
            input.password,
        );

        if (!passwordIsValid) {
            throw new AuthError(
                'INVALID_CREDENTIALS',
                'Email ou password inválidos.',
            );
        }

        const now = new Date();

        await this.authRepository.updateLastLogin(user.id, now);

        const authenticatedSessionInput: CreateAuthenticatedSessionInput = {
            userId: user.id,
            tokenVersion: user.token_version,
        };

        if (input.ipAddress !== undefined) {
            authenticatedSessionInput.ipAddress = input.ipAddress;
        }

        if (input.userAgent !== undefined) {
            authenticatedSessionInput.userAgent = input.userAgent;
        }

        if (input.deviceFingerprint !== undefined) {
            authenticatedSessionInput.deviceFingerprint = input.deviceFingerprint;
        }

        return this.createAuthenticatedSession(authenticatedSessionInput);
    }

    /**
     * Refresh token rotation.
     *
     * Recebe o refresh token atual, valida o segredo privado,
     * marca o token antigo como usado/rodado e emite um novo par.
     */
    async refresh(input: RefreshInput): Promise<AuthResult> {
        const parsedToken = this.tokenService.parseRefreshToken(input.refreshToken);

        if (!parsedToken) {
            throw new AuthError(
                'INVALID_REFRESH_TOKEN',
                'Refresh token inválido.',
            );
        }

        const existingRefreshToken =
            await this.authRepository.findActiveRefreshTokenById(
                parsedToken.refreshTokenId,
            );

        if (
            !existingRefreshToken ||
            !existingRefreshToken.session ||
            !existingRefreshToken.session.user
        ) {
            throw new AuthError(
                'INVALID_REFRESH_TOKEN',
                'Refresh token inválido.',
            );
        }

        const secretIsValid =
            await this.tokenService.verifyRefreshTokenSecret(
                parsedToken.secret,
                existingRefreshToken.token_hash,
            );

        if (!secretIsValid) {
            throw new AuthError(
                'INVALID_REFRESH_TOKEN',
                'Refresh token inválido.',
            );
        }

        const now = new Date();

        await this.authRepository.markRefreshTokenAsUsed(
            existingRefreshToken.id,
            now,
        );

        await this.authRepository.touchSession(
            existingRefreshToken.sessionId,
            now,
        );

        const user = existingRefreshToken.session.user;

        const newAuthResult = await this.createAuthenticatedSession({
            userId: user.id,
            tokenVersion: user.token_version,
            sessionId: existingRefreshToken.sessionId,
        });

        const parsedNewRefreshToken = this.tokenService.parseRefreshToken(
            newAuthResult.refreshToken,
        );

        if (!parsedNewRefreshToken) {
            throw new AuthError(
                'INVALID_REFRESH_TOKEN',
                'Refresh token inválido.',
            );
        }

        await this.authRepository.rotateRefreshToken({
            currentRefreshTokenId: existingRefreshToken.id,
            replacementRefreshTokenId: parsedNewRefreshToken.refreshTokenId,
        });

        return newAuthResult;
    }

    /**
     * Logout da sessão atual.
     */
    async logout(input: LogoutInput): Promise<void> {
        const now = new Date();

        await this.authRepository.revokeSession({
            sessionId: input.sessionId,
            revokedAt: now,
        });

        if (input.refreshTokenId) {
            await this.authRepository.revokeRefreshToken({
                refreshTokenId: input.refreshTokenId,
                revokedAt: now,
            });

            return;
        }

        await this.authRepository.revokeActiveRefreshTokensBySession(
            input.sessionId,
            now,
        );
    }

    /**
     * Logout global.
     *
     * Revoga todas as sessões e incrementa token_version,
     * invalidando access tokens antigos.
     */
    async logoutAll(input: LogoutAllInput): Promise<void> {
        const now = new Date();

        await this.authRepository.incrementUserTokenVersion(input.userId);

        await this.authRepository.revokeAllUserSessions(input.userId, now);
    }

    /**
     * Cria access token + refresh token.
     *
     * Pode criar uma nova sessão ou reutilizar uma sessão existente
     * durante refresh token rotation.
     */
    private async createAuthenticatedSession(
        input: CreateAuthenticatedSessionInput,
    ): Promise<AuthResult> {
        const session = input.sessionId
            ? await this.authRepository.findActiveSession(input.sessionId)
            : await this.authRepository.createSession(
                this.buildCreateSessionInput(input),
            );

        if (!session) {
            throw new AuthError(
                'SESSION_NOT_FOUND',
                'Sessão não encontrada.',
            );
        }

        const refreshTokenSecret =
            this.tokenService.generateRefreshTokenSecret();

        const refreshTokenHash =
            await this.tokenService.hashRefreshTokenSecret(refreshTokenSecret);

        const refreshTokenRecord =
            await this.authRepository.createRefreshToken({
                sessionId: session.id,
                tokenHash: refreshTokenHash,
                expiresAt: this.createRefreshTokenExpirationDate(),
            });

        const accessTokenPayload: AccessTokenPayload = {
            sub: input.userId,
            sessionId: session.id,
            tokenVersion: input.tokenVersion,
        };

        const accessToken =
            await this.tokenService.createAccessToken(accessTokenPayload);

        const refreshToken = this.tokenService.buildRefreshToken(
            refreshTokenRecord.id,
            refreshTokenSecret,
        );

        return {
            accessToken,
            refreshToken,
        };
    }

    /**
     * Constrói input de criação de sessão sem enviar propriedades undefined.
     *
     * Com exactOptionalPropertyTypes ativo,
     * uma propriedade opcional ausente é diferente de uma propriedade
     * presente com valor undefined.
     */
    private buildCreateSessionInput(
        input: CreateAuthenticatedSessionInput,
    ): CreateSessionRepositoryInput {
        const createSessionInput: CreateSessionRepositoryInput = {
            userId: input.userId,
            expiresAt: this.createRefreshTokenExpirationDate(),
        };

        if (input.ipAddress !== undefined) {
            createSessionInput.ipAddress = input.ipAddress;
        }

        if (input.userAgent !== undefined) {
            createSessionInput.userAgent = input.userAgent;
        }

        if (input.deviceFingerprint !== undefined) {
            createSessionInput.deviceFingerprint = input.deviceFingerprint;
        }

        return createSessionInput;
    }

    /**
     * Calcula expiração do refresh token
     * com base no ambiente.
     */
    private createRefreshTokenExpirationDate(): Date {
        return new Date(Date.now() + env.JWT_REFRESH_TOKEN_TTL_SECONDS * 1000);
    }
}