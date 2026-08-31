import {
    AuthProviderType,
    AuthSessionStatus,
    RefreshTokenStatus,
    SourceType,
    type DatabaseClient,
} from '@vicehub/database';

interface CreateLocalUserInput {
    email: string;
    username: string;
    passwordHash: string;
}

interface CreateAuthSessionInput {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
    expiresAt: Date;
}

interface CreateRefreshTokenInput {
    sessionId: string;
    tokenHash: string;
    expiresAt: Date;
}

interface RotateRefreshTokenInput {
    currentRefreshTokenId: string;
    replacementRefreshTokenId: string;
}

interface RevokeRefreshTokenInput {
    refreshTokenId: string;
    revokedAt: Date;
}

interface RevokeSessionInput {
    sessionId: string;
    revokedAt: Date;
}

/**
 * Repositório da autenticação.
 *
 * Esta camada é a única responsável por falar com a base de dados
 * dentro do módulo Auth.
 *
 * Não contém regras de negócio como validação de passwords,
 * emissão de JWT ou rotação de tokens. Isso pertence ao AuthService.
 */
export class AuthRepository {
    constructor(private readonly database: DatabaseClient) { }

    /**
     * Procura um utilizador pelo email.
     *
     * Inclui credenciais porque o login local precisa validar password.
     */
    findUserByEmail(email: string) {
        return this.database.user.findFirst({
            where: {
                email,
                is_deleted: false,
            },
            include: {
                /**
                 * credentials é uma relação to-one, por isso não aceita
                 * filtro próprio. O estado is_deleted da credencial é
                 * validado explicitamente no AuthService.
                 */
                credentials: true,
            },
        });
    }

    /**
     * Procura um utilizador pelo ID.
     *
     * Usado em refresh token, validação de sessão
     * e reconstrução de contexto autenticado.
     */
    findUserById(userId: string) {
        return this.database.user.findFirst({
            where: {
                id: userId,
                is_deleted: false,
            },
        });
    }

    /**
     * Cria um utilizador local com credenciais.
     *
     * User e UserCredential são criados na mesma transação lógica Prisma,
     * garantindo consistência entre identidade e credencial.
     */
    createLocalUser(input: CreateLocalUserInput) {
        return this.database.user.create({
            data: {
                email: input.email,
                username: input.username,
                source: SourceType.api,
                credentials: {
                    create: {
                        password_hash: input.passwordHash,
                        source: SourceType.api,
                    },
                },
                authProviders: {
                    create: {
                        provider: AuthProviderType.local,
                        provider_user_id: input.email,
                        provider_email: input.email,
                        source: SourceType.api,
                    },
                },
            },
            include: {
                credentials: true,
            },
        });
    }

    /**
     * Atualiza metadados de login.
     *
     * Não altera password nem sessão.
     */
    updateLastLogin(userId: string, loggedInAt: Date) {
        return this.database.user.update({
            where: {
                id: userId,
            },
            data: {
                last_login_at: loggedInAt,
                version: {
                    increment: 1,
                },
            },
        });
    }

    /**
     * Regista uma tentativa de login falhada.
     *
     * O incremento é feito pela base de dados e não em memória, para que
     * tentativas concorrentes não se sobreponham e percam contagens.
     */
    registerFailedLoginAttempt(credentialId: string) {
        return this.database.userCredential.update({
            where: {
                id: credentialId,
            },
            data: {
                failed_login_attempts: {
                    increment: 1,
                },
                version: {
                    increment: 1,
                },
            },
        });
    }

    /**
     * Bloqueia a credencial até à data indicada.
     *
     * O contador é reposto no mesmo movimento: depois de o bloqueio
     * expirar, o utilizador volta a ter o conjunto completo de tentativas
     * em vez de ser bloqueado de novo à primeira falha.
     */
    lockCredential(credentialId: string, lockedUntil: Date) {
        return this.database.userCredential.update({
            where: {
                id: credentialId,
            },
            data: {
                locked_until: lockedUntil,
                failed_login_attempts: 0,
                version: {
                    increment: 1,
                },
            },
        });
    }

    /**
     * Limpa o estado de bloqueio após um login bem sucedido.
     */
    clearFailedLoginAttempts(credentialId: string) {
        return this.database.userCredential.update({
            where: {
                id: credentialId,
            },
            data: {
                locked_until: null,
                failed_login_attempts: 0,
                version: {
                    increment: 1,
                },
            },
        });
    }

    /**
     * Cria uma sessão autenticada.
     *
     * Cada login cria uma AuthSession própria,
     * permitindo logout por dispositivo.
     */
    createSession(input: CreateAuthSessionInput) {
        return this.database.authSession.create({
            data: {
                userId: input.userId,
                status: AuthSessionStatus.active,
                ip_address: input.ipAddress ?? null,
                user_agent: input.userAgent ?? null,
                device_fingerprint: input.deviceFingerprint ?? null,
                expires_at: input.expiresAt,
                source: SourceType.api,
            },
        });
    }

    /**
     * Procura uma sessão ativa.
     */
    findActiveSession(sessionId: string) {
        return this.database.authSession.findFirst({
            where: {
                id: sessionId,
                status: AuthSessionStatus.active,
                is_deleted: false,
                expires_at: {
                    gt: new Date(),
                },
            },
        });
    }

    /**
     * Procura uma sessão ativa com o utilizador associado.
     *
     * Usado pelo middleware de autenticação para confirmar que
     * a sessão do access token continua válida na base de dados.
     */
    findActiveSessionWithUser(sessionId: string) {
        return this.database.authSession.findFirst({
            where: {
                id: sessionId,
                status: AuthSessionStatus.active,
                is_deleted: false,
                expires_at: {
                    gt: new Date(),
                },
            },
            include: {
                user: true,
            },
        });
    }

    /**
     * Atualiza a última utilização da sessão.
     */
    touchSession(sessionId: string, usedAt: Date) {
        return this.database.authSession.update({
            where: {
                id: sessionId,
            },
            data: {
                last_used_at: usedAt,
                version: {
                    increment: 1,
                },
            },
        });
    }

    /**
     * Cria o registo persistente do refresh token.
     *
     * Apenas o hash é guardado.
     */
    createRefreshToken(input: CreateRefreshTokenInput) {
        return this.database.refreshToken.create({
            data: {
                sessionId: input.sessionId,
                token_hash: input.tokenHash,
                status: RefreshTokenStatus.active,
                expires_at: input.expiresAt,
                source: SourceType.api,
            },
        });
    }

    /**
     * Procura um refresh token pelo ID, independentemente do estado.
     *
     * É necessário para detetar reutilização: um token já rodado ou
     * revogado que volte a aparecer indica que foi comprometido.
     */
    findRefreshTokenById(refreshTokenId: string) {
        return this.database.refreshToken.findUnique({
            where: {
                id: refreshTokenId,
            },
        });
    }

    /**
     * Procura um refresh token ativo pelo ID.
     *
     * Usado no refresh flow.
     * O token recebido pelo cliente contém o ID público
     * e o segredo privado separado.
     */
    findActiveRefreshTokenById(refreshTokenId: string) {
        return this.database.refreshToken.findFirst({
            where: {
                id: refreshTokenId,
                status: RefreshTokenStatus.active,
                is_deleted: false,
                expires_at: {
                    gt: new Date(),
                },
            },
            include: {
                session: {
                    include: {
                        user: true,
                    },
                },
            },
        });
    }

    /**
     * Lista refresh tokens ativos de uma sessão.
     *
     * Isto será usado no refresh flow para encontrar o token
     * cujo hash corresponde ao token recebido do cliente.
     */
    findActiveRefreshTokensBySession(sessionId: string) {
        return this.database.refreshToken.findMany({
            where: {
                sessionId,
                status: RefreshTokenStatus.active,
                is_deleted: false,
                expires_at: {
                    gt: new Date(),
                },
            },
            orderBy: {
                created_at: 'desc',
            },
        });
    }

    /**
     * Marca um refresh token como usado.
     *
     * Ajuda a detetar replay attack quando um token antigo
     * volta a aparecer depois de ter sido rodado.
     */
    markRefreshTokenAsUsed(refreshTokenId: string, usedAt: Date) {
        return this.database.refreshToken.update({
            where: {
                id: refreshTokenId,
            },
            data: {
                used_at: usedAt,
                version: {
                    increment: 1,
                },
            },
        });
    }

    /**
     * Marca um refresh token como rodado.
     */
    rotateRefreshToken(input: RotateRefreshTokenInput) {
        return this.database.refreshToken.update({
            where: {
                id: input.currentRefreshTokenId,
            },
            data: {
                status: RefreshTokenStatus.rotated,
                rotated_at: new Date(),
                replaced_by_token_id: input.replacementRefreshTokenId,
                version: {
                    increment: 1,
                },
            },
        });
    }

    /**
     * Revoga um refresh token específico.
     */
    revokeRefreshToken(input: RevokeRefreshTokenInput) {
        return this.database.refreshToken.update({
            where: {
                id: input.refreshTokenId,
            },
            data: {
                status: RefreshTokenStatus.revoked,
                revoked_at: input.revokedAt,
                version: {
                    increment: 1,
                },
            },
        });
    }

    /**
     * Revoga uma sessão específica.
     */
    revokeSession(input: RevokeSessionInput) {
        return this.database.authSession.update({
            where: {
                id: input.sessionId,
            },
            data: {
                status: AuthSessionStatus.revoked,
                revoked_at: input.revokedAt,
                version: {
                    increment: 1,
                },
            },
        });
    }

    /**
     * Revoga todos os refresh tokens ativos de uma sessão.
     */
    revokeActiveRefreshTokensBySession(sessionId: string, revokedAt: Date) {
        return this.database.refreshToken.updateMany({
            where: {
                sessionId,
                status: RefreshTokenStatus.active,
                is_deleted: false,
            },
            data: {
                status: RefreshTokenStatus.revoked,
                revoked_at: revokedAt,
                version: {
                    increment: 1,
                },
            },
        });
    }

    /**
     * Revoga uma sessão e todos os seus refresh tokens ativos.
     *
     * As duas operações correm na mesma transação para que nunca
     * exista um estado intermédio em que a sessão está revogada mas
     * os tokens continuam utilizáveis.
     */
    revokeSessionWithRefreshTokens(sessionId: string, revokedAt: Date) {
        return this.database.$transaction([
            this.database.refreshToken.updateMany({
                where: {
                    sessionId,
                    status: RefreshTokenStatus.active,
                    is_deleted: false,
                },
                data: {
                    status: RefreshTokenStatus.revoked,
                    revoked_at: revokedAt,
                    version: {
                        increment: 1,
                    },
                },
            }),
            this.database.authSession.update({
                where: {
                    id: sessionId,
                },
                data: {
                    status: AuthSessionStatus.revoked,
                    revoked_at: revokedAt,
                    version: {
                        increment: 1,
                    },
                },
            }),
        ]);
    }

    /**
     * Logout global.
     *
     * Incrementar token_version invalida todos os access tokens antigos.
     */
    incrementUserTokenVersion(userId: string) {
        return this.database.user.update({
            where: {
                id: userId,
            },
            data: {
                token_version: {
                    increment: 1,
                },
                version: {
                    increment: 1,
                },
            },
        });
    }

    /**
     * Revoga todas as sessões ativas de um utilizador.
     */
    revokeAllUserSessions(userId: string, revokedAt: Date) {
        return this.database.authSession.updateMany({
            where: {
                userId,
                status: AuthSessionStatus.active,
                is_deleted: false,
            },
            data: {
                status: AuthSessionStatus.revoked,
                revoked_at: revokedAt,
                version: {
                    increment: 1,
                },
            },
        });
    }
}