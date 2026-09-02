import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { SourceType, prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * Subscrição vitalícia, contra PostgreSQL a sério.
 *
 * É o gesto que se faz a quem apoiou a plataforma no princípio: acesso
 * premium que não termina e nunca é cobrado. Metade das garantias que
 * interessam aqui vivem em restrições da base de dados — um `premium`
 * sem fim seria acesso gratuito para sempre sem que nada o dissesse, e
 * um `lifetime` com fim expirava um dia a quem lhe foi prometido que
 * não expirava. Nenhum duplo em memória as verifica.
 */
describe('subscrição vitalícia', () => {
    let app: FastifyInstance;

    const marca = `life${Date.now()}`;

    let admin: string;
    let fundador: string;
    let fundadorId: string;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    const register = async (username: string): Promise<string> => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: `${username}@vicehub.test`,
                username,
                password: 'Sup3rS3cret!Pass',
            },
        });

        expect(response.statusCode, response.body).toBe(201);

        return response.json().accessToken as string;
    };

    const userIdOf = async (token: string): Promise<string> => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/users/me',
            headers: auth(token),
        });

        return response.json().id as string;
    };

    /**
     * Conceder é ato de administração, por isso o teste precisa mesmo de
     * um administrador — e não de uma forma de contornar o guard.
     */
    const makeAdmin = async (userId: string): Promise<void> => {
        const role = await prisma.role.findFirstOrThrow({
            where: { slug: 'admin', is_deleted: false },
            select: { id: true },
        });

        await prisma.userRole.create({
            data: { userId, roleId: role.id, source: SourceType.api },
        });
    };

    const grant = (body: Record<string, unknown>) =>
        app.inject({
            method: 'POST',
            url: '/api/v1/subscriptions/grant',
            headers: auth(admin),
            payload: body,
        });

    const mine = async (token: string) => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/subscriptions/me',
            headers: auth(token),
        });

        expect(response.statusCode, response.body).toBe(200);

        return response.json() as {
            isPremium: boolean;
            isLifetime: boolean;
            activeUntil: string | null;
        };
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        admin = await register(`${marca}a`);
        await makeAdmin(await userIdOf(admin));

        fundador = await register(`${marca}f`);
        fundadorId = await userIdOf(fundador);
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    describe('conceder', () => {
        it('só quem administra a pode conceder', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/subscriptions/grant',
                headers: auth(fundador),
                payload: {
                    ownerKind: 'user',
                    ownerId: fundadorId,
                    plan: 'lifetime',
                },
            });

            expect(response.statusCode, response.body).toBe(403);
        });

        it('grava-a sem fim e a custo zero', async () => {
            const response = await grant({
                ownerKind: 'user',
                ownerId: fundadorId,
                plan: 'lifetime',
            });

            expect(response.statusCode, response.body).toBe(201);
            expect(response.json().plan).toBe('lifetime');
            expect(response.json().currentPeriodEnd).toBeNull();
            expect(response.json().priceCents).toBe(0);
        });

        /**
         * `activeUntil: null` sozinho é ambíguo: é o que se vê tanto em
         * quem não tem plano como em quem tem um vitalício.
         */
        it('distingue-se de quem não tem plano nenhum', async () => {
            const doFundador = await mine(fundador);

            expect(doFundador.isPremium).toBe(true);
            expect(doFundador.isLifetime).toBe(true);
            expect(doFundador.activeUntil).toBeNull();

            const doAdmin = await mine(admin);

            expect(doAdmin.isPremium).toBe(false);
            expect(doAdmin.isLifetime).toBe(false);
            expect(doAdmin.activeUntil).toBeNull();
        });

        it('recusa uma duração para um plano que não termina', async () => {
            const response = await grant({
                ownerKind: 'user',
                ownerId: fundadorId,
                plan: 'lifetime',
                months: 12,
            });

            expect(response.statusCode, response.body).toBe(400);
        });

        it('recusa estender quem já tem acesso vitalício', async () => {
            const response = await grant({
                ownerKind: 'user',
                ownerId: fundadorId,
                months: 3,
            });

            expect(response.statusCode, response.body).toBe(409);
            expect(response.json().code).toBe('ALREADY_LIFETIME');
        });
    });

    /**
     * O que a base de dados garante sozinha. Sem estas restrições havia
     * duas maneiras de errar em silêncio, e ambas custam dinheiro.
     */
    describe('a base de dados não deixa a forma e o plano discordarem', () => {
        const base = {
            current_period_start: new Date('2026-01-01T00:00:00.000Z'),
            price_cents: 0,
            source: SourceType.api,
        };

        it('recusa um premium sem fim, que seria acesso grátis para sempre', async () => {
            await expect(
                prisma.subscription.create({
                    data: {
                        ...base,
                        userId: fundadorId,
                        plan: 'premium',
                        current_period_end: null,
                    },
                }),
            ).rejects.toThrow();
        });

        it('recusa um vitalício com fim, que um dia expirava', async () => {
            await expect(
                prisma.subscription.create({
                    data: {
                        ...base,
                        userId: fundadorId,
                        plan: 'lifetime',
                        current_period_end: new Date('2027-01-01T00:00:00.000Z'),
                    },
                }),
            ).rejects.toThrow();
        });

        it('continua a recusar um período invertido', async () => {
            await expect(
                prisma.subscription.create({
                    data: {
                        ...base,
                        userId: fundadorId,
                        plan: 'premium',
                        current_period_end: new Date('2025-01-01T00:00:00.000Z'),
                    },
                }),
            ).rejects.toThrow();
        });
    });

    describe('desbloqueia o que o plano desbloqueia', () => {
        it('deixa personalizar o perfil sem nunca ter pago', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: '/api/v1/users/me/appearance',
                headers: auth(fundador),
                payload: { accentColor: '#1B9AAA' },
            });

            expect(response.statusCode, response.body).toBe(200);
            expect(response.json().appearance.accentColor).toBe('#1B9AAA');
        });
    });

    /**
     * Sem revogação, um acesso oferecido por engano — ou a quem depois
     * abusa da plataforma — não teria como ser retirado: não há período
     * que se deixe acabar.
     */
    describe('retirar', () => {
        let subscriptionId: string;

        beforeAll(async () => {
            const subscricao = await prisma.subscription.findFirstOrThrow({
                where: { userId: fundadorId, plan: 'lifetime', is_deleted: false },
                select: { id: true },
            });

            subscriptionId = subscricao.id;
        });

        it('não se cancela no fim do período, porque não há fim', async () => {
            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/subscriptions/${subscriptionId}/cancel`,
                headers: auth(admin),
            });

            expect(response.statusCode, response.body).toBe(409);
            expect(response.json().code).toBe('LIFETIME_CANNOT_BE_CANCELED');
        });

        it('revoga-se, e o acesso cai no mesmo instante', async () => {
            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/subscriptions/${subscriptionId}/revoke`,
                headers: auth(admin),
            });

            expect(response.statusCode, response.body).toBe(200);

            const depois = await mine(fundador);

            expect(depois.isPremium).toBe(false);
            expect(depois.isLifetime).toBe(false);
        });

        /**
         * O registo não é apagado: o histórico continua a dizer que
         * existiu e até quando.
         */
        it('deixa o registo no histórico, com o fim marcado', async () => {
            const subscricao = await prisma.subscription.findFirstOrThrow({
                where: { id: subscriptionId },
                select: { status: true, ended_at: true, is_deleted: true },
            });

            expect(subscricao.status).toBe('canceled');
            expect(subscricao.ended_at).not.toBeNull();
            expect(subscricao.is_deleted).toBe(false);
        });

        it('não se revoga duas vezes', async () => {
            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/subscriptions/${subscriptionId}/revoke`,
                headers: auth(admin),
            });

            expect(response.statusCode, response.body).toBe(409);
            expect(response.json().code).toBe('SUBSCRIPTION_ALREADY_ENDED');
        });
    });
});
