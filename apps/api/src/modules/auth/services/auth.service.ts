import { DEFAULT_USER_ROLE, ROLES } from '@vicehub/database';

import { env } from '../../../config/env.js';
import { AuthError } from '../errors/auth.errors.js';
import { getUniqueConstraintFields } from '../repositories/prisma-errors.js';
import type { AuthRepository } from '../repositories/auth.repository.js';
import type {
    AccessTokenPayload,
    AuthenticatedUser,
} from '../types/auth.types.js';
import { normalizeEmail } from './email.js';
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

interface LogoutInput {
    sessionId: string;
}

interface LogoutAllInput {
    userId: string;
}

/**
 * Resultado interno da autenticação.
 *
 * O refreshToken sai daqui em texto simples porque tem de ser
 * escrito no cookie HttpOnly pela camada HTTP. Nunca é devolvido
 * no corpo da resposta.
 */
interface AuthResult {
    accessToken: string;
    refreshToken: string;
    user: AuthenticatedUser;
}

interface SessionOwner {
    id: string;
    email: string;
    username: string;
    token_version: number;
}

interface CreateSessionRepositoryInput {
    userId: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
}

interface SessionMetadataInput {
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
        /**
         * O email é normalizado antes de qualquer verificação: sem isso,
         * quem se registasse com outra caixa passava a verificação de
         * unicidade e ficava com uma segunda conta para a mesma caixa de
         * correio.
         */
        const email = normalizeEmail(input.email);

        /**
         * Email e username têm ambos restrição de unicidade, por isso
         * ambos são verificados. Sem a verificação do username, o conflito
         * só aparecia como erro da base de dados e o registo respondia 500.
         */
        const existingIdentity = await this.authRepository.findExistingIdentity(
            email,
            input.username,
        );

        if (existingIdentity) {
            throw existingIdentity.email === email
                ? new AuthError(
                    'EMAIL_ALREADY_EXISTS',
                    'Já existe uma conta com este email.',
                )
                : new AuthError(
                    'USERNAME_ALREADY_EXISTS',
                    'Este nome de utilizador já está em uso.',
                );
        }

        const defaultRoleId = await this.resolveDefaultRoleId();

        const passwordHash = await this.passwordService.hash(input.password);

        const user = await this.createLocalUser({
            email,
            username: input.username,
            passwordHash,
            defaultRoleId,
        });

        const session = await this.authRepository.createSession(
            this.buildCreateSessionInput(user.id, {}),
        );

        return this.issueTokens(session.id, user);
    }

    /**
     * Login local com email e password.
     */
    async login(input: LoginInput): Promise<AuthResult> {
        /**
         * A mesma normalização do registo, pela mesma razão: quem
         * escrevesse o próprio email com outra caixa não se conseguia
         * autenticar na conta que criou.
         */
        const user = await this.authRepository.findUserByEmail(
            normalizeEmail(input.email),
        );

        /**
         * A credencial é uma relação separada e tem soft delete próprio,
         * por isso não basta o utilizador existir.
         */
        if (!user || !user.credentials || user.credentials.is_deleted) {
            /**
             * Consumimos sempre o custo de uma verificação de password,
             * mesmo sem utilizador, para que o tempo de resposta não
             * revele se o email está registado.
             */
            await this.passwordService.simulateVerification();

            throw new AuthError(
                'INVALID_CREDENTIALS',
                'Email ou password inválidos.',
            );
        }

        const credentials = user.credentials;

        /**
         * O bloqueio é verificado antes de validar a password. Se fosse
         * depois, cada tentativa continuaria a consumir um Argon2 completo
         * e o bloqueio não protegeria o servidor de nada.
         */
        this.assertCredentialIsNotLocked(credentials.locked_until);

        const passwordIsValid = await this.passwordService.verify(
            credentials.password_hash,
            input.password,
        );

        if (!passwordIsValid) {
            throw await this.registerFailedLoginAttempt(credentials.id);
        }

        const now = new Date();

        /**
         * Só escrevemos quando há mesmo estado para limpar, para não
         * gerar uma escrita e um incremento de versão em cada login.
         */
        if (credentials.failed_login_attempts > 0 || credentials.locked_until) {
            await this.authRepository.clearFailedLoginAttempts(credentials.id);
        }

        await this.authRepository.updateLastLogin(user.id, now);

        const session = await this.authRepository.createSession(
            this.buildCreateSessionInput(user.id, input),
        );

        return this.issueTokens(session.id, user);
    }

    /**
     * Refresh token rotation.
     *
     * Recebe o refresh token atual, valida o segredo privado,
     * marca o token antigo como rodado e emite um novo par.
     */
    async refresh(refreshToken: string): Promise<AuthResult> {
        const parsedToken = this.tokenService.parseRefreshToken(refreshToken);

        if (!parsedToken) {
            throw new AuthError(
                'INVALID_REFRESH_TOKEN',
                'Refresh token inválido.',
            );
        }

        /**
         * Procuramos o token independentemente do estado, porque um
         * token já rodado que volte a ser apresentado é um sinal de
         * comprometimento e tem de ser tratado, não apenas rejeitado.
         */
        const storedToken = await this.authRepository.findRefreshTokenById(
            parsedToken.refreshTokenId,
        );

        if (!storedToken) {
            throw new AuthError(
                'INVALID_REFRESH_TOKEN',
                'Refresh token inválido.',
            );
        }

        const secretIsValid = await this.tokenService.verifyRefreshTokenSecret(
            parsedToken.secret,
            storedToken.token_hash,
        );

        /**
         * Só depois de confirmar o segredo é que distinguimos os casos.
         * Sem esta ordem, bastaria adivinhar um ID válido para revogar
         * a sessão de outro utilizador.
         */
        if (!secretIsValid) {
            throw new AuthError(
                'INVALID_REFRESH_TOKEN',
                'Refresh token inválido.',
            );
        }

        const now = new Date();

        if (
            storedToken.status === 'rotated' ||
            storedToken.status === 'revoked'
        ) {
            /**
             * Deteção de reutilização.
             *
             * O token é autêntico mas já foi substituído. Isso significa
             * que existem duas cópias em circulação, por isso revogamos
             * toda a família de tokens da sessão.
             */
            await this.authRepository.revokeSessionWithRefreshTokens(
                storedToken.sessionId,
                now,
            );

            throw new AuthError(
                'REFRESH_TOKEN_REUSED',
                'Este refresh token já tinha sido utilizado. A sessão foi terminada por segurança.',
            );
        }

        if (storedToken.is_deleted || storedToken.expires_at <= now) {
            throw new AuthError(
                'INVALID_REFRESH_TOKEN',
                'Refresh token expirado.',
            );
        }

        const session = await this.authRepository.findActiveSessionWithUser(
            storedToken.sessionId,
        );

        if (!session || !session.user || session.user.is_deleted) {
            throw new AuthError(
                'INVALID_REFRESH_TOKEN',
                'A sessão associada a este token já não está ativa.',
            );
        }

        await this.authRepository.markRefreshTokenAsUsed(storedToken.id, now);

        await this.authRepository.touchSession(session.id, now);

        const authResult = await this.issueTokens(session.id, session.user);

        const parsedNewToken = this.tokenService.parseRefreshToken(
            authResult.refreshToken,
        );

        if (!parsedNewToken) {
            throw new AuthError(
                'INVALID_REFRESH_TOKEN',
                'Não foi possível emitir um novo refresh token.',
            );
        }

        await this.authRepository.rotateRefreshToken({
            currentRefreshTokenId: storedToken.id,
            replacementRefreshTokenId: parsedNewToken.refreshTokenId,
        });

        return authResult;
    }

    /**
     * Logout da sessão atual.
     *
     * O sessionId vem sempre do access token do pedido,
     * nunca de dados enviados pelo cliente.
     */
    async logout(input: LogoutInput): Promise<void> {
        await this.authRepository.revokeSessionWithRefreshTokens(
            input.sessionId,
            new Date(),
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
     * Recusa o login enquanto a conta estiver bloqueada.
     *
     * A mensagem indica quanto falta para o desbloqueio, para que o
     * utilizador legítimo saiba o que esperar.
     */
    private assertCredentialIsNotLocked(lockedUntil: Date | null): void {
        if (!lockedUntil || lockedUntil <= new Date()) {
            return;
        }

        throw this.buildAccountLockedError(lockedUntil);
    }

    /**
     * Constrói o erro de conta bloqueada, indicando quanto falta para o
     * desbloqueio para que o utilizador legítimo saiba o que esperar.
     */
    private buildAccountLockedError(lockedUntil: Date): AuthError {
        const remainingMinutes = Math.max(
            1,
            Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000),
        );

        return new AuthError(
            'ACCOUNT_LOCKED',
            `Demasiadas tentativas de início de sessão falhadas. Tenta novamente dentro de ${remainingMinutes} minuto(s).`,
        );
    }

    /**
     * Contabiliza uma tentativa falhada e devolve o erro a lançar.
     *
     * Bloqueia a conta quando o limite configurado é atingido, caso em
     * que o erro devolvido passa a ser o de conta bloqueada.
     */
    private async registerFailedLoginAttempt(
        credentialId: string,
    ): Promise<AuthError> {
        const credentials =
            await this.authRepository.registerFailedLoginAttempt(credentialId);

        if (
            credentials.failed_login_attempts >= env.AUTH_MAX_FAILED_LOGIN_ATTEMPTS
        ) {
            const lockedUntil = new Date(
                Date.now() + env.AUTH_LOCKOUT_DURATION_SECONDS * 1000,
            );

            await this.authRepository.lockCredential(credentialId, lockedUntil);

            return this.buildAccountLockedError(lockedUntil);
        }

        return new AuthError(
            'INVALID_CREDENTIALS',
            'Email ou password inválidos.',
        );
    }

    /**
     * Cria o utilizador, traduzindo um conflito de unicidade da base de
     * dados no erro de domínio correspondente.
     *
     * A verificação prévia não elimina a corrida: entre verificar e
     * inserir pode entrar outro registo com o mesmo email ou username.
     * Sem isto, essa corrida devolveria 500.
     */
    /**
     * Obtém o cargo base a atribuir a uma conta nova.
     *
     * Os cargos são criados pelo seed. Se este não tiver corrido, o
     * registo falha em vez de criar contas sem cargo: uma conta sem
     * autorização nenhuma é um estado difícil de detetar depois, e mais
     * difícil ainda de corrigir em massa.
     */
    private async resolveDefaultRoleId(): Promise<string> {
        const role = await this.authRepository.findRoleIdBySlug(
            ROLES[DEFAULT_USER_ROLE].slug,
            ROLES[DEFAULT_USER_ROLE].scope,
        );

        if (!role) {
            throw new Error(
                `[ViceHub Auth] O cargo base "${ROLES[DEFAULT_USER_ROLE].slug}" não existe na base de dados. Corre "npm run db:seed".`,
            );
        }

        return role.id;
    }

    private async createLocalUser(input: {
        email: string;
        username: string;
        passwordHash: string;
        defaultRoleId: string;
    }) {
        try {
            return await this.authRepository.createLocalUser(input);
        } catch (error: unknown) {
            const conflictingFields = getUniqueConstraintFields(error);

            if (!conflictingFields) {
                throw error;
            }

            throw conflictingFields.includes('username')
                ? new AuthError(
                    'USERNAME_ALREADY_EXISTS',
                    'Este nome de utilizador já está em uso.',
                )
                : new AuthError(
                    'EMAIL_ALREADY_EXISTS',
                    'Já existe uma conta com este email.',
                );
        }
    }

    /**
     * Emite o par access token + refresh token para uma sessão existente.
     */
    private async issueTokens(
        sessionId: string,
        owner: SessionOwner,
    ): Promise<AuthResult> {
        const refreshTokenSecret = this.tokenService.generateRefreshTokenSecret();

        const refreshTokenHash =
            await this.tokenService.hashRefreshTokenSecret(refreshTokenSecret);

        const refreshTokenRecord = await this.authRepository.createRefreshToken({
            sessionId,
            tokenHash: refreshTokenHash,
            expiresAt: this.createRefreshTokenExpirationDate(),
        });

        const accessTokenPayload: AccessTokenPayload = {
            sub: owner.id,
            sessionId,
            tokenVersion: owner.token_version,
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
            user: {
                id: owner.id,
                email: owner.email,
                username: owner.username,
                tokenVersion: owner.token_version,
            },
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
        userId: string,
        metadata: SessionMetadataInput,
    ): CreateSessionRepositoryInput {
        const createSessionInput: CreateSessionRepositoryInput = {
            userId,
            expiresAt: this.createRefreshTokenExpirationDate(),
        };

        if (metadata.ipAddress !== undefined) {
            createSessionInput.ipAddress = metadata.ipAddress;
        }

        if (metadata.userAgent !== undefined) {
            createSessionInput.userAgent = metadata.userAgent;
        }

        if (metadata.deviceFingerprint !== undefined) {
            createSessionInput.deviceFingerprint = metadata.deviceFingerprint;
        }

        return createSessionInput;
    }

    /**
     * Calcula expiração do refresh token
     * com base na configuração do ambiente.
     */
    private createRefreshTokenExpirationDate(): Date {
        return new Date(Date.now() + env.JWT_REFRESH_TOKEN_TTL_SECONDS * 1000);
    }
}
