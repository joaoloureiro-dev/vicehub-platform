import type { FastifyReply, FastifyRequest } from 'fastify';

import type {
    AuthResponseDto,
    LoginDto,
    LogoutAllDto,
    LogoutDto,
    RefreshTokenDto,
    RegisterDto,
} from '../dto/auth.dto.js';
import type { AuthService } from '../services/auth.service.js';

/**
 * Controller responsável pela autenticação.
 *
 * Apenas coordena HTTP.
 * Toda a lógica permanece no AuthService.
 */
export class AuthController {
    constructor(
        private readonly authService: AuthService,
    ) { }

    /**
     * POST /auth/register
     */
    async register(
        request: FastifyRequest<{ Body: RegisterDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const result = await this.authService.register(request.body);

        reply.code(201).send(result satisfies AuthResponseDto);
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

        reply.send(result satisfies AuthResponseDto);
    }

    /**
     * POST /auth/refresh
     */
    async refresh(
        request: FastifyRequest<{ Body: RefreshTokenDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const result = await this.authService.refresh(request.body);

        reply.send(result satisfies AuthResponseDto);
    }

    /**
     * POST /auth/logout
     */
    async logout(
        request: FastifyRequest<{ Body: LogoutDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const logoutInput: {
            sessionId: string;
            refreshTokenId?: string;
        } = {
            sessionId: request.body.sessionId,
        };

        if (request.body.refreshTokenId !== undefined) {
            logoutInput.refreshTokenId = request.body.refreshTokenId;
        }

        await this.authService.logout(logoutInput);

        reply.status(204).send();
    }

    /**
     * POST /auth/logout-all
     */
    async logoutAll(
        request: FastifyRequest<{ Body: LogoutAllDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.authService.logoutAll(request.body);

        reply.status(204).send();
    }
}