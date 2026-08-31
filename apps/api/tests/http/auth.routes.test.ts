import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../../src/app.js';

/**
 * Testes ao contrato HTTP do módulo de autenticação.
 *
 * Cobrem apenas os caminhos que são decididos antes de chegar à base de
 * dados: validação de entrada e recusa de pedidos não autenticados.
 * Por isso a suite corre sem qualquer PostgreSQL disponível.
 */
describe('rotas de autenticação', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    describe('rotas públicas', () => {
        it('responde ao health check', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/health',
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toMatchObject({
                status: 'ok',
                service: 'vicehub-api',
            });
        });
    });

    describe('validação de entrada', () => {
        it('recusa um registo inválido e identifica cada campo', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/register',
                payload: {
                    email: 'nao-e-um-email',
                    username: 'a',
                    password: '123',
                },
            });

            expect(response.statusCode).toBe(400);

            const body = response.json();

            expect(body.code).toBe('VALIDATION_ERROR');
            expect(body.issues.map((issue: { path: string }) => issue.path)).toEqual([
                'email',
                'username',
                'password',
            ]);
        });

        it('recusa um pedido sem corpo', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/register',
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().code).toBe('VALIDATION_ERROR');
        });

        it('recusa um login sem password', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/login',
                payload: { email: 'player@vicehub.com' },
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().code).toBe('VALIDATION_ERROR');
        });

        it('não revela a política de passwords no login', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/login',
                payload: { email: 'player@vicehub.com', password: 'x' },
            });

            /**
             * Uma password curta tem de passar a validação do login: se
             * fosse rejeitada com 400, o erro revelaria o tamanho mínimo
             * exigido no registo.
             */
            expect(response.statusCode).not.toBe(400);
        });
    });

    describe('rotas protegidas', () => {
        it.each([
            ['POST', '/api/v1/auth/logout'],
            ['POST', '/api/v1/auth/logout-all'],
            ['GET', '/api/v1/auth/me'],
        ])('recusa %s %s sem access token', async (method, url) => {
            const response = await app.inject({
                method: method as 'GET' | 'POST',
                url,
            });

            expect(response.statusCode).toBe(401);
            expect(response.json().code).toBe('INVALID_ACCESS_TOKEN');
        });

        it('recusa um access token com assinatura inválida', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/auth/me',
                headers: {
                    authorization:
                        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEifQ.assinatura-falsa',
                },
            });

            expect(response.statusCode).toBe(401);
            expect(response.json().code).toBe('INVALID_ACCESS_TOKEN');
        });

        it('ignora identificadores enviados no corpo do pedido', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/logout',
                payload: { sessionId: 'sessao-de-outro-utilizador' },
            });

            /**
             * A identidade vem sempre do access token. Sem token o pedido
             * é recusado, mesmo trazendo um sessionId no corpo.
             */
            expect(response.statusCode).toBe(401);
        });
    });

    describe('refresh', () => {
        it('recusa o pedido quando não há cookie', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/refresh',
            });

            expect(response.statusCode).toBe(401);
            expect(response.json().code).toBe('INVALID_REFRESH_TOKEN');
        });

        it('limpa o cookie quando o refresh falha', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/refresh',
                headers: { cookie: 'vicehub_refresh_token=token-invalido' },
            });

            expect(response.statusCode).toBe(401);

            const cookie = response.cookies.find(
                (candidate) => candidate.name === 'vicehub_refresh_token',
            );

            expect(cookie?.value).toBe('');
        });
    });
});
