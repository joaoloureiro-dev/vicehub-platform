import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AuthController } from '../../src/modules/auth/controllers/auth.controller.js';
import { AuthError } from '../../src/modules/auth/errors/auth.errors.js';
import type { AuthService } from '../../src/modules/auth/services/auth.service.js';

/**
 * Testes à camada HTTP do módulo de autenticação.
 *
 * Garantem que o refresh token só existe no cookie e que a identidade
 * usada nas rotas protegidas vem do contexto autenticado, nunca do
 * corpo do pedido.
 */
describe('AuthController', () => {
    let authService: {
        register: ReturnType<typeof vi.fn>;
        login: ReturnType<typeof vi.fn>;
        refresh: ReturnType<typeof vi.fn>;
        logout: ReturnType<typeof vi.fn>;
        logoutAll: ReturnType<typeof vi.fn>;
    };
    let controller: AuthController;
    let reply: {
        code: ReturnType<typeof vi.fn>;
        status: ReturnType<typeof vi.fn>;
        send: ReturnType<typeof vi.fn>;
        setCookie: ReturnType<typeof vi.fn>;
        clearCookie: ReturnType<typeof vi.fn>;
    };

    const authResult = {
        accessToken: 'access-token',
        refreshToken: 'refresh-1.segredo-do-refresh-token',
        user: {
            id: 'user-1',
            email: 'player@vicehub.com',
            username: 'player',
            tokenVersion: 1,
        },
    };

    const sentBody = () => reply.send.mock.calls[0]?.[0] as Record<string, unknown>;

    beforeEach(() => {
        authService = {
            register: vi.fn().mockResolvedValue(authResult),
            login: vi.fn().mockResolvedValue(authResult),
            refresh: vi.fn().mockResolvedValue(authResult),
            logout: vi.fn().mockResolvedValue(undefined),
            logoutAll: vi.fn().mockResolvedValue(undefined),
        };

        reply = {
            code: vi.fn().mockReturnThis(),
            status: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis(),
            setCookie: vi.fn().mockReturnThis(),
            clearCookie: vi.fn().mockReturnThis(),
        };

        controller = new AuthController(authService as unknown as AuthService);
    });

    const asReply = () => reply as unknown as FastifyReply;

    const buildRequest = (overrides: Record<string, unknown> = {}) =>
        ({
            body: {},
            headers: {},
            cookies: {},
            ip: '203.0.113.10',
            authContext: null,
            ...overrides,
        }) as unknown as FastifyRequest;

    describe('register e login', () => {
        it('coloca o refresh token num cookie e nunca no corpo', async () => {
            await controller.register(
                buildRequest({
                    body: {
                        email: 'player@vicehub.com',
                        username: 'player',
                        password: 'password-forte-123',
                    },
                }) as never,
                asReply(),
            );

            expect(reply.setCookie).toHaveBeenCalledWith(
                'vicehub_refresh_token',
                authResult.refreshToken,
                expect.objectContaining({ httpOnly: true, path: '/api/v1/auth' }),
            );

            expect(sentBody()).toEqual({
                accessToken: 'access-token',
                user: {
                    id: 'user-1',
                    email: 'player@vicehub.com',
                    username: 'player',
                },
            });

            expect(JSON.stringify(sentBody())).not.toContain('segredo-do-refresh-token');
        });

        it('responde 201 ao registo', async () => {
            await controller.register(buildRequest({ body: {} }) as never, asReply());

            expect(reply.code).toHaveBeenCalledWith(201);
        });

        it('não expõe a tokenVersion do utilizador', async () => {
            await controller.login(
                buildRequest({
                    body: { email: 'player@vicehub.com', password: 'password-forte-123' },
                }) as never,
                asReply(),
            );

            expect(sentBody()).not.toHaveProperty('user.tokenVersion');
        });

        it('regista o IP e o user agent do pedido', async () => {
            await controller.login(
                buildRequest({
                    body: { email: 'player@vicehub.com', password: 'password-forte-123' },
                    headers: { 'user-agent': 'ViceHub/1.0' },
                }) as never,
                asReply(),
            );

            expect(authService.login).toHaveBeenCalledWith(
                expect.objectContaining({
                    ipAddress: '203.0.113.10',
                    userAgent: 'ViceHub/1.0',
                }),
            );
        });
    });

    describe('refresh', () => {
        it('lê o token do cookie e ignora o corpo do pedido', async () => {
            await controller.refresh(
                buildRequest({
                    cookies: { vicehub_refresh_token: 'refresh-do-cookie' },
                    body: { refreshToken: 'refresh-do-corpo' },
                }),
                asReply(),
            );

            expect(authService.refresh).toHaveBeenCalledWith('refresh-do-cookie');
        });

        it('recusa o pedido quando o cookie não existe', async () => {
            await expect(
                controller.refresh(buildRequest(), asReply()),
            ).rejects.toBeInstanceOf(AuthError);

            expect(authService.refresh).not.toHaveBeenCalled();
        });

        it('limpa o cookie quando o refresh falha', async () => {
            authService.refresh.mockRejectedValue(
                new AuthError('REFRESH_TOKEN_REUSED', 'reutilizado'),
            );

            await controller
                .refresh(
                    buildRequest({ cookies: { vicehub_refresh_token: 'token' } }),
                    asReply(),
                )
                .catch(() => undefined);

            expect(reply.clearCookie).toHaveBeenCalledWith(
                'vicehub_refresh_token',
                expect.objectContaining({ path: '/api/v1/auth' }),
            );
        });
    });

    describe('rotas protegidas', () => {
        const authContext = {
            sessionId: 'sessao-do-token',
            user: {
                id: 'utilizador-do-token',
                email: 'player@vicehub.com',
                username: 'player',
                tokenVersion: 1,
            },
        };

        it('termina a sessão do token e ignora o corpo do pedido', async () => {
            await controller.logout(
                buildRequest({
                    authContext,
                    body: { sessionId: 'sessao-de-outro-utilizador' },
                }),
                asReply(),
            );

            expect(authService.logout).toHaveBeenCalledWith({
                sessionId: 'sessao-do-token',
            });
            expect(reply.status).toHaveBeenCalledWith(204);
        });

        it('faz logout global do utilizador do token e ignora o corpo', async () => {
            await controller.logoutAll(
                buildRequest({
                    authContext,
                    body: { userId: 'utilizador-vitima' },
                }),
                asReply(),
            );

            expect(authService.logoutAll).toHaveBeenCalledWith({
                userId: 'utilizador-do-token',
            });
        });

        it('recusa qualquer rota protegida sem contexto autenticado', async () => {
            await expect(
                controller.logout(buildRequest({ authContext: null }), asReply()),
            ).rejects.toBeInstanceOf(AuthError);

            await expect(
                controller.logoutAll(buildRequest({ authContext: null }), asReply()),
            ).rejects.toBeInstanceOf(AuthError);

            await expect(
                controller.me(buildRequest({ authContext: null }), asReply()),
            ).rejects.toBeInstanceOf(AuthError);

            expect(authService.logout).not.toHaveBeenCalled();
            expect(authService.logoutAll).not.toHaveBeenCalled();
        });

        it('devolve o utilizador do contexto em /me', async () => {
            await controller.me(buildRequest({ authContext }), asReply());

            expect(sentBody()).toEqual({
                id: 'utilizador-do-token',
                email: 'player@vicehub.com',
                username: 'player',
            });
        });
    });
});
