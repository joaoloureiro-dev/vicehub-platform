import type { FastifyReply, FastifyRequest } from 'fastify';

import { env } from '../../../config/env.js';
import type {
    AuthResponseDto,
    AuthenticatedUserDto,
    LoginDto,
    RegisterDto,
    RequestPasswordResetDto,
    ResetPasswordDto,
    VerifyEmailDto,
} from '../dto/auth.dto.js';
import { AuthError } from '../errors/auth.errors.js';
import { requireAuthContext } from '../http/auth-context.guard.js';
import {
    clearRefreshTokenCookie,
    setRefreshTokenCookie,
} from '../http/auth-cookie.js';
import type { AccountRecoveryService } from '../services/account-recovery.service.js';
import type { AuthService } from '../services/auth.service.js';
import type { AuthenticatedUser } from '../types/auth.types.js';

/**
 * Controller responsável pela autenticação.
 *
 * Apenas coordena HTTP: lê o pedido, escreve cookies e formata a
 * resposta. Toda a lógica permanece no AuthService.
 */
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly accountRecoveryService: AccountRecoveryService,
    ) { }

    /**
     * POST /auth/register
     */
    async register(
        request: FastifyRequest<{ Body: RegisterDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const result = await this.authService.register(request.body);

        setRefreshTokenCookie(reply, result.refreshToken);

        reply.code(201).send(this.toAuthResponse(result.accessToken, result.user));
    }

    /**
     * POST /auth/login
     */
    async login(
        request: FastifyRequest<{ Body: LoginDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const loginInput: {
            email: string;
            password: string;
            ipAddress?: string;
            userAgent?: string;
        } = {
            email: request.body.email,
            password: request.body.password,
        };

        if (request.ip !== undefined) {
            loginInput.ipAddress = request.ip;
        }

        const userAgent = request.headers['user-agent'];

        if (userAgent !== undefined) {
            loginInput.userAgent = userAgent;
        }

        const result = await this.authService.login(loginInput);

        setRefreshTokenCookie(reply, result.refreshToken);

        reply.send(this.toAuthResponse(result.accessToken, result.user));
    }

    /**
     * POST /auth/refresh
     *
     * Não exige access token: o objetivo desta rota é precisamente
     * renovar um access token que pode já ter expirado. A identidade
     * do pedido vem do cookie HttpOnly.
     */
    async refresh(
        request: FastifyRequest,
        reply: FastifyReply,
    ): Promise<void> {
        const refreshToken = request.cookies[env.AUTH_COOKIE_NAME];

        if (!refreshToken) {
            throw new AuthError(
                'INVALID_REFRESH_TOKEN',
                'Refresh token em falta.',
            );
        }

        try {
            const result = await this.authService.refresh(refreshToken);

            setRefreshTokenCookie(reply, result.refreshToken);

            reply.send(this.toAuthResponse(result.accessToken, result.user));
        } catch (error: unknown) {
            /**
             * Se o refresh falhou, o cookie que o cliente tem já não
             * serve para nada. Removê-lo evita repetições do mesmo erro.
             */
            clearRefreshTokenCookie(reply);

            throw error;
        }
    }

    /**
     * POST /auth/logout
     *
     * A sessão terminada é sempre a do access token do pedido.
     */
    async logout(
        request: FastifyRequest,
        reply: FastifyReply,
    ): Promise<void> {
        const { sessionId } = requireAuthContext(request);

        await this.authService.logout({ sessionId });

        clearRefreshTokenCookie(reply);

        reply.status(204).send();
    }

    /**
     * POST /auth/logout-all
     *
     * Termina todas as sessões do utilizador autenticado.
     */
    async logoutAll(
        request: FastifyRequest,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.authService.logoutAll({ userId: user.id });

        clearRefreshTokenCookie(reply);

        reply.status(204).send();
    }

    /**
     * GET /auth/me
     *
     * Rota protegida que devolve o utilizador autenticado.
     * O contexto já foi validado contra a base de dados pelo
     * middleware, por isso não é preciso consultar nada aqui.
     */
    async me(request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const { user } = requireAuthContext(request);

        reply.send(this.toUserResponse(user));
    }

    /**
     * POST /auth/password-reset
     *
     * Responde sempre 202, exista a conta ou não. Distinguir os dois
     * casos daria a qualquer pessoa uma forma de descobrir quem está
     * registado — basta experimentar endereços.
     */
    async requestPasswordReset(
        request: FastifyRequest<{ Body: RequestPasswordResetDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.accountRecoveryService.requestPasswordReset(
            request.body.email,
            this.contextOf(request),
        );

        reply.code(202).send({
            message:
                'Se existir uma conta com este email, o link de recuperação foi enviado.',
        });
    }

    /**
     * POST /auth/password-reset/confirm
     *
     * Não devolve sessão: quem acabou de definir a password entra pelo
     * login, como qualquer pessoa. Emitir tokens aqui faria de um link
     * de email um caminho de entrada — precisamente o que se acaba de
     * fechar a quem o tivesse intercetado.
     */
    async resetPassword(
        request: FastifyRequest<{ Body: ResetPasswordDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.accountRecoveryService.resetPassword(
            request.body.token,
            request.body.password,
        );

        /**
         * O cookie de refresh deste browser é limpo: a recuperação
         * revogou todas as sessões, e deixar o cookie lá só daria erros
         * confusos no pedido seguinte.
         */
        clearRefreshTokenCookie(reply);

        reply.status(204).send();
    }

    /**
     * POST /auth/email-verification
     */
    async requestEmailVerification(
        request: FastifyRequest,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.accountRecoveryService.requestEmailVerification(
            user.id,
            this.contextOf(request),
        );

        reply.code(202).send({ message: 'Email de confirmação enviado.' });
    }

    /**
     * POST /auth/email-verification/confirm
     *
     * Sem autenticação: quem clica no link vem do email, e exigir sessão
     * aberta faria falhar o caso mais comum — abrir o email noutro
     * dispositivo.
     */
    async verifyEmail(
        request: FastifyRequest<{ Body: VerifyEmailDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.accountRecoveryService.verifyEmail(request.body.token);

        reply.status(204).send();
    }

    /**
     * De onde veio o pedido, para o caso de ser preciso investigar um
     * abuso.
     */
    private contextOf(request: FastifyRequest): {
        ipAddress: string | null;
        userAgent: string | null;
    } {
        const userAgent = request.headers['user-agent'];

        return {
            ipAddress: request.ip ?? null,
            userAgent: typeof userAgent === 'string' ? userAgent : null,
        };
    }

    /**
     * O refresh token nunca entra no corpo da resposta.
     */
    private toAuthResponse(
        accessToken: string,
        user: AuthenticatedUser,
    ): AuthResponseDto {
        return {
            accessToken,
            user: this.toUserResponse(user),
        };
    }

    private toUserResponse(user: AuthenticatedUser): AuthenticatedUserDto {
        return {
            id: user.id,
            email: user.email,
            username: user.username,
        };
    }
}
