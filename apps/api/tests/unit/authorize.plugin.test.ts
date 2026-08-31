import Fastify, { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { PermissionScope } from '@vicehub/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import authenticatePlugin from '../../src/plugins/auth/authenticate.plugin.js';
import authorizePlugin from '../../src/plugins/auth/authorize.plugin.js';
import errorHandlerPlugin from '../../src/plugins/http/error-handler.plugin.js';
import jwtPlugin from '../../src/plugins/auth/jwt.plugin.js';

/**
 * Testes ao guard de permissões com um Prisma falso.
 *
 * Exercitam a ligação completa entre o plugin, o repositório e o
 * serviço, sem depender de uma base de dados.
 */
describe('guard de permissões', () => {
    let app: FastifyInstance;
    let sessionFindFirst: ReturnType<typeof vi.fn>;
    let userRoleFindMany: ReturnType<typeof vi.fn>;

    const activeSession = {
        id: 'session-1',
        userId: 'user-1',
        user: {
            id: 'user-1',
            email: 'player@vicehub.com',
            username: 'player',
            token_version: 1,
            is_deleted: false,
        },
    };

    const grantRole = (...permissions: { scope: PermissionScope; slug: string }[]) => {
        userRoleFindMany.mockResolvedValue([
            {
                role: {
                    slug: 'cargo',
                    scope: 'global',
                    rolePermissions: permissions.map((permission) => ({ permission })),
                },
            },
        ]);
    };

    beforeEach(async () => {
        sessionFindFirst = vi.fn().mockResolvedValue(activeSession);
        userRoleFindMany = vi.fn().mockResolvedValue([]);

        const prismaStub = fp(
            async (instance) => {
                instance.decorate('prisma', {
                    authSession: { findFirst: sessionFindFirst },
                    userRole: { findMany: userRoleFindMany },
                } as never);
            },
            { name: 'prisma-plugin' },
        );

        app = Fastify();

        await app.register(errorHandlerPlugin);
        await app.register(prismaStub);
        await app.register(jwtPlugin);
        await app.register(authenticatePlugin);
        await app.register(authorizePlugin);

        app.get(
            '/crews/:crewId/gerir',
            { preHandler: [app.authenticate, app.authorize('crew:manage')] },
            async () => ({ ok: true }),
        );

        app.get(
            '/duas-permissoes',
            {
                preHandler: [
                    app.authenticate,
                    app.authorize('crew:read', 'crew:manage'),
                ],
            },
            async () => ({ ok: true }),
        );

        /**
         * Rota deliberadamente sem authenticate, para confirmar que o
         * guard não trata a ausência de contexto como acesso anónimo.
         */
        app.get(
            '/sem-autenticacao',
            { preHandler: [app.authorize('crew:read')] },
            async () => ({ ok: true }),
        );

        await app.ready();
    });

    afterEach(async () => {
        await app.close();
    });

    const call = (url: string, authenticated = true) =>
        app.inject({
            method: 'GET',
            url,
            headers: authenticated
                ? {
                    authorization: `Bearer ${app.jwt.sign({
                        sub: 'user-1',
                        sessionId: 'session-1',
                        tokenVersion: 1,
                    })}`,
                }
                : {},
        });

    it('autoriza quem tem a permissão exigida', async () => {
        grantRole({ scope: PermissionScope.crew, slug: 'manage' });

        const response = await call('/crews/crew-1/gerir');

        expect(response.statusCode).toBe(200);
    });

    it('recusa com 403 quem não a tem', async () => {
        grantRole({ scope: PermissionScope.crew, slug: 'read' });

        const response = await call('/crews/crew-1/gerir');

        expect(response.statusCode).toBe(403);
        expect(response.json().code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('diz quais as permissões em falta', async () => {
        grantRole({ scope: PermissionScope.crew, slug: 'read' });

        const response = await call('/duas-permissoes');

        expect(response.json().missingPermissions).toEqual(['crew:manage']);
    });

    it('recusa com 403 e não 401, porque o utilizador está identificado', async () => {
        const response = await call('/crews/crew-1/gerir');

        expect(response.statusCode).toBe(403);
    });

    it('avalia no âmbito da crew indicada na rota', async () => {
        grantRole({ scope: PermissionScope.crew, slug: 'manage' });

        await call('/crews/crew-99/gerir');

        const where = userRoleFindMany.mock.calls[0]?.[0]?.where as {
            OR: { crewId: string | null }[];
        };

        /**
         * Sem isto, um cargo atribuído noutra crew autorizaria a
         * operação nesta.
         */
        expect(where.OR).toContainEqual({ crewId: 'crew-99', serverId: null });
    });

    it('lê as permissões uma só vez por pedido', async () => {
        grantRole(
            { scope: PermissionScope.crew, slug: 'read' },
            { scope: PermissionScope.crew, slug: 'manage' },
        );

        await call('/duas-permissoes');

        expect(userRoleFindMany).toHaveBeenCalledOnce();
    });

    it('recusa uma rota que se esqueça do authenticate', async () => {
        grantRole({ scope: PermissionScope.crew, slug: 'read' });

        const response = await call('/sem-autenticacao');

        /**
         * Esquecer o authenticate tem de ser um erro visível e não uma
         * rota aberta.
         */
        expect(response.statusCode).toBe(401);
        expect(userRoleFindMany).not.toHaveBeenCalled();
    });

    it('recusa um pedido sem token', async () => {
        const response = await call('/crews/crew-1/gerir', false);

        expect(response.statusCode).toBe(401);
    });

    it('system:manage autoriza qualquer rota', async () => {
        grantRole({ scope: PermissionScope.system, slug: 'manage' });

        expect((await call('/crews/crew-1/gerir')).statusCode).toBe(200);
        expect((await call('/duas-permissoes')).statusCode).toBe(200);
    });
});
