import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';
import { BillingRepository } from '../../src/modules/billing/repositories/billing.repository.js';

/**
 * O que o webhook escreve na base de dados.
 *
 * O serviço decide **que plano** é — isso mede-se sem base de dados —,
 * mas quem o escreve é o repositório, e é aqui que se prova que o que
 * ele escreve é o que lhe foi dito. Durante muito tempo não era: o
 * plano estava fixo em `premium` nesta camada, e um servidor que
 * pagasse o escalão sem limite ficava com o plano de uma crew, que lhe
 * dava três lugares em vez de nenhum limite.
 *
 * Um teste em memória não apanhava isso: o valor é um enum do
 * PostgreSQL, e o que interessa é a linha que lá fica.
 */
describe('o que a cobrança grava', () => {
    let app: FastifyInstance;
    let repository: BillingRepository;
    let serverId: string;

    const marca = `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;

    const gravar = async (
        plan: 'premium' | 'server_base' | 'server_plus' | 'server_unlimited',
        subscriptionId: string,
    ) => {
        await repository.upsertPeriod({
            owner: { serverId },
            providerSubscriptionId: subscriptionId,
            providerCustomerId: `cus_${marca}`,
            plan,
            status: 'active',
            priceCents: 1_999,
            currency: 'EUR',
            periodStart: new Date('2026-09-01T00:00:00.000Z'),
            periodEnd: new Date('2026-10-01T00:00:00.000Z'),
            cancelAtPeriodEnd: false,
        });

        return prisma.subscription.findFirstOrThrow({
            where: { provider_subscription_id: subscriptionId },
            select: { plan: true, price_cents: true, currency: true },
        });
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        repository = new BillingRepository(prisma);

        const registo = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: `grava${marca}@vicehub.test`,
                username: `grava${marca}`,
                password: 'Sup3rS3cret!Pass',
            },
        });

        expect(registo.statusCode, registo.body).toBe(201);

        const servidor = await app.inject({
            method: 'POST',
            url: '/api/v1/servers',
            headers: {
                authorization: `Bearer ${registo.json().accessToken as string}`,
            },
            payload: { name: `Grava ${marca}` },
        });

        expect(servidor.statusCode, servidor.body).toBe(201);
        serverId = servidor.json().id as string;
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it.each([
        'premium',
        'server_base',
        'server_plus',
        'server_unlimited',
    ] as const)('grava %s tal como lho dizem', async (plan) => {
        const linha = await gravar(plan, `sub_${marca}_${plan}`);

        expect(linha.plan).toBe(plan);
    });

    /**
     * A mesma subscrição do Stripe a mudar de escalão — uma subida
     * feita no painel — tem de mudar a linha, e não abrir uma segunda.
     * Duas linhas ativas para o mesmo servidor dariam-lhe o melhor dos
     * dois escalões para sempre.
     */
    it('uma mudança de escalão reescreve a mesma linha', async () => {
        const id = `sub_${marca}_mudanca`;

        await gravar('server_base', id);

        expect((await gravar('server_unlimited', id)).plan).toBe(
            'server_unlimited',
        );

        const linhas = await prisma.subscription.count({
            where: { provider_subscription_id: id },
        });

        expect(linhas).toBe(1);
    });
});
