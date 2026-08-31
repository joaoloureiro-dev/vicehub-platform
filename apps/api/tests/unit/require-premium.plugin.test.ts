import Fastify, { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import authenticatePlugin from '../../src/plugins/auth/authenticate.plugin.js';
import errorHandlerPlugin from '../../src/plugins/http/error-handler.plugin.js';
import jwtPlugin from '../../src/plugins/auth/jwt.plugin.js';
import requirePremiumPlugin from '../../src/plugins/billing/require-premium.plugin.js';

/**
 * Testes ao guard de subscrição com um Prisma falso.
 */
describe('guard de subscrição', () => {
    let app: FastifyInstance;
    let subscriptionFindFirst: ReturnType<typeof vi.fn>;

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

    const periodEnd = new Date(Date.now() + 30 * 24 * 3_600_000);

    const grantPremium = () => {
        subscriptionFindFirst.mockResolvedValue({
            status: 'active',
            current_period_end: periodEnd,
        });
    };

    beforeEach(async () => {
        subscriptionFindFirst = vi.fn().mockResolvedValue(null);

        const prismaStub = fp(
            async (instance) => {
                instance.decorate('prisma', {
                    authSession: { findFirst: vi.fn().mockResolvedValue(activeSession) },
                    subscription: { findFirst: subscriptionFindFirst, findMany: vi.fn() },
                } as never);
            },
            { name: 'prisma-plugin' },
        );

        app = Fastify();

        await app.register(errorHandlerPlugin);
        await app.register(prismaStub);
        await app.register(jwtPlugin);
        await app.register(authenticatePlugin);
        await app.register(requirePremiumPlugin);

        app.get(
            '/premium',
            { preHandler: [app.authenticate, app.requirePremium()] },
            async (request) => ({ activeUntil: request.entitlement?.activeUntil }),
        );

        app.get(
            '/crews/:crewId/premium',
            { preHandler: [app.authenticate, app.requirePremium('crew')] },
            async () => ({ ok: true }),
        );

        app.get(
            '/sem-id/premium',
            { preHandler: [app.authenticate, app.requirePremium('crew')] },
            async () => ({ ok: true }),
        );

        /**
         * Rota de crew deliberadamente sem authenticate, para confirmar
         * que o guard não trata a ausência de contexto como anónimo
         * autorizado.
         */
        app.get(
            '/crews/:crewId/sem-autenticacao',
            { preHandler: [app.requirePremium('crew')] },
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

    it('deixa passar quem tem plano ativo', async () => {
        grantPremium();

        const response = await call('/premium');

        expect(response.statusCode).toBe(200);
        expect(response.json().activeUntil).toBe(periodEnd.toISOString());
    });

    it('recusa com 402 quem não tem plano', async () => {
        const response = await call('/premium');

        /**
         * 402 e não 403: não faltam permissões, falta o pagamento.
         */
        expect(response.statusCode).toBe(402);
        expect(response.json().code).toBe('SUBSCRIPTION_REQUIRED');
    });

    it('exige autenticação antes de olhar para o plano', async () => {
        const response = await call('/premium', false);

        expect(response.statusCode).toBe(401);
        expect(subscriptionFindFirst).not.toHaveBeenCalled();
    });

    it('por omissão avalia o plano de quem faz o pedido', async () => {
        grantPremium();

        await call('/premium');

        expect(subscriptionFindFirst.mock.calls[0]?.[0]?.where).toMatchObject({
            userId: 'user-1',
            crewId: null,
        });
    });

    it('com titular crew avalia o plano da crew da rota', async () => {
        grantPremium();

        await call('/crews/crew-9/premium');

        /**
         * O plano de quem faz o pedido não serve para uma rota que exige
         * o plano da crew.
         */
        expect(subscriptionFindFirst.mock.calls[0]?.[0]?.where).toMatchObject({
            userId: null,
            crewId: 'crew-9',
        });
    });

    it('recusa uma rota de crew que se esqueça do authenticate', async () => {
        grantPremium();

        const response = await call('/crews/crew-9/sem-autenticacao');

        /**
         * Sem esta verificação, uma rota mal escrita daria acesso ao
         * plano de uma crew a quem nem sequer está autenticado.
         */
        expect(response.statusCode).toBe(401);
        expect(subscriptionFindFirst).not.toHaveBeenCalled();
    });

    it('falha de forma clara quando a rota não indica a crew', async () => {
        grantPremium();

        const response = await call('/sem-id/premium');

        expect(response.statusCode).toBe(500);
        expect(response.json().code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('não expõe detalhes internos no erro de configuração', async () => {
        grantPremium();

        const response = await call('/sem-id/premium');

        expect(response.body).not.toContain('titular');
    });
});
