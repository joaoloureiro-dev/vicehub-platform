import Fastify, { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import authenticatePlugin from '../../src/plugins/auth/authenticate.plugin.js';
import errorHandlerPlugin from '../../src/plugins/http/error-handler.plugin.js';
import jwtPlugin from '../../src/plugins/auth/jwt.plugin.js';
import type { AccessTokenPayload } from '../../src/modules/auth/types/auth.types.js';

/**
 * Testes ao middleware de autenticação com um Prisma falso.
 *
 * Permitem exercitar a ligação completa entre o plugin, o repositório e
 * o AuthContextService sem depender de uma base de dados.
 */
describe('middleware de autenticação', () => {
    let app: FastifyInstance;
    let findFirst: ReturnType<typeof vi.fn>;

    const payload: AccessTokenPayload = {
        sub: 'user-1',
        sessionId: 'session-1',
        tokenVersion: 1,
    };

    /**
     * O que a base devolve: o dono de uma sessão viva, em cinco
     * campos. A pergunta é feita ao utilizador com a sessão na
     * condição — uma instrução em vez de duas.
     */
    const donoDaSessao = {
        id: 'user-1',
        email: 'player@vicehub.com',
        username: 'player',
        token_version: 1,
        is_deleted: false,
    };

    beforeEach(async () => {
        findFirst = vi.fn();

        const prismaStub = fp(
            async (instance) => {
                instance.decorate('prisma', {
                    user: { findFirst },
                } as never);
            },
            { name: 'prisma-plugin' },
        );

        app = Fastify();

        await app.register(errorHandlerPlugin);
        await app.register(prismaStub);
        await app.register(jwtPlugin);
        await app.register(authenticatePlugin);

        app.get(
            '/protegida',
            { preHandler: [app.authenticate] },
            async (request) => request.authContext,
        );

        app.get('/publica', async (request) => ({
            authContext: request.authContext,
        }));

        await app.ready();
    });

    afterEach(async () => {
        await app.close();
    });

    const callProtected = (token: string) =>
        app.inject({
            method: 'GET',
            url: '/protegida',
            headers: { authorization: `Bearer ${token}` },
        });

    it('preenche o contexto quando a sessão está ativa', async () => {
        findFirst.mockResolvedValue(donoDaSessao);

        const response = await callProtected(app.jwt.sign(payload));

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            sessionId: 'session-1',
            user: {
                id: 'user-1',
                email: 'player@vicehub.com',
                username: 'player',
                tokenVersion: 1,
            },
        });
    });

    it('consulta mesmo a base de dados em cada pedido autenticado', async () => {
        findFirst.mockResolvedValue(donoDaSessao);

        await callProtected(app.jwt.sign(payload));

        /**
         * Se esta chamada desaparecer, a autenticação volta a confiar
         * apenas na assinatura do JWT.
         */
        expect(findFirst).toHaveBeenCalledOnce();
    });

    it('recusa um token cuja sessão já foi revogada', async () => {
        findFirst.mockResolvedValue(null);

        const response = await callProtected(app.jwt.sign(payload));

        expect(response.statusCode).toBe(401);
        expect(response.json().code).toBe('INVALID_ACCESS_TOKEN');
    });

    it('recusa um token com tokenVersion desatualizada', async () => {
        findFirst.mockResolvedValue({ ...donoDaSessao, token_version: 2 });

        const response = await callProtected(app.jwt.sign(payload));

        expect(response.statusCode).toBe(401);
    });

    /**
     * E um token emitido para outra pessoa não passa com o
     * identificador de uma sessão alheia. É a confusão que a leitura
     * do lado do utilizador tinha de continuar a apanhar: quem a base
     * devolve é o dono da sessão que o token nomeia, e tem de ser quem
     * o token diz ser.
     */
    it('recusa um token cujo dono não é o da sessão', async () => {
        findFirst.mockResolvedValue({ ...donoDaSessao, id: 'outra-pessoa' });

        const response = await callProtected(app.jwt.sign(payload));

        expect(response.statusCode).toBe(401);
        expect(response.json().code).toBe('INVALID_ACCESS_TOKEN');
    });

    it('recusa quem foi apagado com a sessão ainda viva', async () => {
        findFirst.mockResolvedValue({ ...donoDaSessao, is_deleted: true });

        const response = await callProtected(app.jwt.sign(payload));

        expect(response.statusCode).toBe(401);
    });

    it('deixa o contexto a null em rotas sem o middleware', async () => {
        const response = await app.inject({ method: 'GET', url: '/publica' });

        expect(response.json()).toEqual({ authContext: null });
        expect(findFirst).not.toHaveBeenCalled();
    });
});
