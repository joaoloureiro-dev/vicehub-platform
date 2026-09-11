import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';
import { darPlano } from '../helpers/plans.fixtures.js';

/**
 * O que a plataforma dá e o que vende, contra PostgreSQL a sério.
 *
 * A regra tem duas metades e as duas importam: **ler a tesouraria é de
 * graça, mexer no dinheiro é que é o plano**. Metade de um paywall é
 * pior do que nenhum — um que feche a leitura esconde a uma crew o
 * dinheiro que é dela, e um que deixe passar as escritas não vende nada.
 *
 * E o plano é o **da comunidade**, não o de quem faz o pedido. É o erro
 * mais fácil de cometer aqui, e o mais caro: bastaria uma pessoa com
 * premium próprio para mexer na tesouraria de qualquer crew que não
 * pague nada.
 */
describe('a tesouraria por trás do plano', () => {
    let app: FastifyInstance;

    const marca = `pw${Date.now().toString().slice(-9)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    /** Lidera a crew sem plano. */
    let lider: string;
    let liderId: string;
    let crewId: string;

    /** Uma crew igual, mas com plano. */
    let crewPaga: string;

    /** Um servidor sem plano. */
    let dono: string;
    let serverId: string;

    /** Um movimento pendente, criado enquanto a crew ainda tinha plano. */
    let movimentoId: string;

    const register = async (username: string) => {
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

        return {
            token: response.json().accessToken as string,
            id: response.json().user.id as string,
        };
    };

    const criarCrew = async (token: string, sufixo: string) => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(token),
            payload: {
                name: `Crew ${sufixo}${marca}`,
                tag: `${sufixo}${marca.slice(-5)}`,
            },
        });

        expect(response.statusCode, response.body).toBe(201);

        return response.json().id as string;
    };

    const propor = (token: string, crew: string) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/treasury/crews/${crew}/movements`,
            headers: auth(token),
            payload: {
                amount: '500',
                direction: 'credit',
                category: 'contribution',
                description: 'Ganhos',
            },
        });

    const saldoDa = async (crew: string): Promise<bigint> => {
        const carteira = await prisma.wallet.findFirstOrThrow({
            where: { crewId: crew, is_deleted: false },
            select: { balance: true },
        });

        return carteira.balance;
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        const l = await register(`l${marca}`);
        lider = l.token;
        liderId = l.id;

        crewId = await criarCrew(lider, 'a');
        crewPaga = await criarCrew(lider, 'b');

        const d = await register(`d${marca}`);
        dono = d.token;

        const servidor = await app.inject({
            method: 'POST',
            url: '/api/v1/servers',
            headers: auth(dono),
            payload: { name: `Server ${marca}` },
        });

        expect(servidor.statusCode, servidor.body).toBe(201);
        serverId = servidor.json().id as string;

        await darPlano({ crewId: crewPaga });

        /**
         * A crew sem plano **teve** plano: é assim que fica com um
         * movimento pendente por decidir, que é o caso que interessa —
         * o plano acaba e alguém tem uma decisão a meio.
         */
        await darPlano({ crewId });

        const proposto = await propor(lider, crewId);

        expect(proposto.statusCode, proposto.body).toBe(201);
        movimentoId = proposto.json().id as string;

        await prisma.subscription.updateMany({
            where: { crewId },
            data: { status: 'canceled' },
        });
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    describe('ler continua de graça', () => {
        it('a crew sem plano vê a sua tesouraria', async () => {
            const resposta = await app.inject({
                method: 'GET',
                url: `/api/v1/treasury/crews/${crewId}`,
                headers: auth(lider),
            });

            expect(resposta.statusCode, resposta.body).toBe(200);
        });

        it('e vê as divisões passadas', async () => {
            const resposta = await app.inject({
                method: 'GET',
                url: `/api/v1/treasury/crews/${crewId}/distributions`,
                headers: auth(lider),
            });

            expect(resposta.statusCode, resposta.body).toBe(200);
        });

        it('o servidor sem plano também vê a sua', async () => {
            const resposta = await app.inject({
                method: 'GET',
                url: `/api/v1/treasury/servers/${serverId}`,
                headers: auth(dono),
            });

            expect(resposta.statusCode, resposta.body).toBe(200);
        });
    });

    describe('mexer no dinheiro exige plano', () => {
        it('não propõe um movimento', async () => {
            const resposta = await propor(lider, crewId);

            expect(resposta.statusCode, resposta.body).toBe(402);
            expect(resposta.json().code).toBe('SUBSCRIPTION_REQUIRED');
        });

        /**
         * Uma decisão a meio é o caso mais delicado: o movimento já
         * existe, ficou pendente, e o plano acabou. A resposta é recusar
         * — mas sem tocar em nada.
         */
        it('não aprova o que ficou pendente, e não lhe toca', async () => {
            const antes = await saldoDa(crewId);

            const resposta = await app.inject({
                method: 'POST',
                url: `/api/v1/treasury/crews/${crewId}/movements/${movimentoId}/approve`,
                headers: auth(lider),
            });

            expect(resposta.statusCode, resposta.body).toBe(402);

            expect(await saldoDa(crewId)).toBe(antes);

            const movimento = await prisma.transaction.findFirstOrThrow({
                where: { id: movimentoId },
                select: { status: true },
            });

            expect(movimento.status).toBe('pending');
        });

        it('não propõe uma divisão', async () => {
            const resposta = await app.inject({
                method: 'POST',
                url: `/api/v1/treasury/crews/${crewId}/distributions`,
                headers: auth(lider),
                payload: { total: '100', basis: 'equal' },
            });

            expect(resposta.statusCode, resposta.body).toBe(402);
        });

        it('o servidor sem plano não transfere para uma crew', async () => {
            const resposta = await app.inject({
                method: 'POST',
                url: `/api/v1/treasury/servers/${serverId}/transfers`,
                headers: auth(dono),
                payload: { crewId: crewPaga, amount: '100' },
            });

            expect(resposta.statusCode, resposta.body).toBe(402);
        });
    });

    /**
     * O plano é da comunidade e não de quem clica.
     *
     * Este é o teste que separa `requirePremium('crew')` de
     * `requirePremium()`. O segundo compila, passa em todos os testes
     * que olham só para o caminho feliz, e abre a tesouraria de
     * **qualquer** crew a quem tenha comprado premium para si.
     */
    it('o premium de quem lidera não abre a tesouraria da crew', async () => {
        await prisma.subscription.create({
            data: {
                userId: liderId,
                plan: 'premium',
                status: 'active',
                price_cents: 1_000,
                currency: 'USD',
                current_period_start: new Date(),
                current_period_end: new Date(Date.now() + 30 * 86_400_000),
            },
        });

        const proprio = await app.inject({
            method: 'GET',
            url: '/api/v1/subscriptions/me',
            headers: auth(lider),
        });

        expect(proprio.json().isPremium).toBe(true);

        const resposta = await propor(lider, crewId);

        expect(resposta.statusCode, resposta.body).toBe(402);
    });

    it('com o plano da crew, a mesma proposta passa', async () => {
        const resposta = await propor(lider, crewPaga);

        expect(resposta.statusCode, resposta.body).toBe(201);
    });
});
