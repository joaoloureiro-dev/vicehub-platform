import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * Atomicidade de uma divisão de ganhos, contra PostgreSQL a sério.
 *
 * A propriedade que estes testes existem para fixar é simples de dizer e
 * impossível de verificar com duplos: ou toda a gente recebe, ou não
 * recebe ninguém. Uma divisão paga a meio deixaria uns membros pagos e
 * outros não, sem forma de saber quem.
 */
describe('divisões de ganhos', () => {
    let app: FastifyInstance;

    const marca = `dist${Date.now()}`;

    let leader: string;
    let crewId: string;
    let memberIds: string[] = [];

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

    const fund = async (amount: string): Promise<void> => {
        const proposta = await app.inject({
            method: 'POST',
            url: `/api/v1/treasury/crews/${crewId}/movements`,
            headers: auth(leader),
            payload: {
                amount,
                direction: 'credit',
                category: 'contribution',
                description: 'Ganhos de missões',
            },
        });

        expect(proposta.statusCode, proposta.body).toBe(201);

        const aprovacao = await app.inject({
            method: 'POST',
            url: `/api/v1/treasury/crews/${crewId}/movements/${proposta.json().id}/approve`,
            headers: auth(leader),
        });

        expect(aprovacao.statusCode, aprovacao.body).toBe(200);
    };

    const propose = async (total: string): Promise<string> => {
        const response = await app.inject({
            method: 'POST',
            url: `/api/v1/treasury/crews/${crewId}/distributions`,
            headers: auth(leader),
            payload: { total, basis: 'equal' },
        });

        expect(response.statusCode, response.body).toBe(201);

        return response.json().id as string;
    };

    const approve = (distributionId: string) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/treasury/crews/${crewId}/distributions/${distributionId}/approve`,
            headers: auth(leader),
        });

    const balances = async (userIds: string[]): Promise<bigint[]> => {
        const carteiras = await prisma.wallet.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, balance: true },
        });

        return userIds.map(
            (userId) =>
                carteiras.find((carteira) => carteira.userId === userId)?.balance ?? 0n,
        );
    };

    const treasury = async (): Promise<bigint> => {
        const carteira = await prisma.wallet.findFirstOrThrow({ where: { crewId } });

        return carteira.balance;
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        leader = await register(`${marca}l`);

        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(leader),
            payload: { name: `Divisoes ${marca}`, tag: `D${marca.slice(-5)}` },
        });

        expect(crew.statusCode, crew.body).toBe(201);
        crewId = crew.json().id as string;

        for (const sufixo of ['a', 'b']) {
            const token = await register(`${marca}${sufixo}`);

            await app.inject({
                method: 'POST',
                url: `/api/v1/crews/${crewId}/join`,
                headers: auth(token),
            });

            const pedidos = await app.inject({
                method: 'GET',
                url: `/api/v1/crews/${crewId}/requests`,
                headers: auth(leader),
            });

            const pendentes = pedidos.json() as { userId: string }[];
            const userId = pendentes[pendentes.length - 1]?.userId as string;

            await app.inject({
                method: 'POST',
                url: `/api/v1/crews/${crewId}/requests/${userId}/accept`,
                headers: auth(leader),
            });
        }

        const membros = await app.inject({
            method: 'GET',
            url: `/api/v1/crews/${crewId}/members`,
        });

        memberIds = (membros.json() as { userId: string }[]).map(
            (membro) => membro.userId,
        );

        expect(memberIds).toHaveLength(3);
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    /**
     * A propriedade central: quando falta saldo, a divisão inteira é
     * desfeita e nem uma parte é paga.
     */
    it('sem saldo suficiente, nem um único membro é pago', async () => {
        const antes = await balances(memberIds);
        const tesouraria = await treasury();

        const divisao = await propose((tesouraria + 1n).toString());

        const resposta = await approve(divisao);

        expect(resposta.statusCode).toBe(409);
        expect(await balances(memberIds)).toEqual(antes);
        expect(await treasury()).toBe(tesouraria);

        const estado = await prisma.distribution.findFirstOrThrow({
            where: { id: divisao },
        });

        /**
         * A divisão volta a pendente: a transação desfaz-se por inteiro,
         * incluindo a marca de aprovada.
         */
        expect(estado.status).toBe('pending');
    });

    it('paga a todos os membros e a soma é exatamente o total', async () => {
        await fund('10000');

        const antes = await balances(memberIds);

        const resposta = await approve(await propose('10000'));

        expect(resposta.statusCode, resposta.body).toBe(200);

        const depois = await balances(memberIds);

        const recebido = depois.map((saldo, indice) => saldo - (antes[indice] ?? 0n));

        expect(recebido.reduce((total, parte) => total + parte, 0n)).toBe(10_000n);
        expect(recebido.every((parte) => parte > 0n)).toBe(true);
    });

    /**
     * Duas aprovações simultâneas da mesma divisão. Só uma pode pagar.
     */
    it('a mesma divisão aprovada duas vezes em simultâneo só paga uma vez', async () => {
        await fund('3000');

        const antes = await balances(memberIds);
        const divisao = await propose('3000');

        const [primeira, segunda] = await Promise.all([
            approve(divisao),
            approve(divisao),
        ]);

        const aceites = [primeira, segunda].filter(
            (resposta) => resposta.statusCode === 200,
        );

        expect(aceites).toHaveLength(1);

        const depois = await balances(memberIds);
        const recebido = depois.map((saldo, indice) => saldo - (antes[indice] ?? 0n));

        expect(recebido.reduce((total, parte) => total + parte, 0n)).toBe(3_000n);
    });

    /**
     * Duas divisões diferentes que, juntas, excedem o saldo.
     */
    it('duas divisões que juntas excedem o saldo não passam ambas', async () => {
        await fund('1000');

        const tesouraria = await treasury();
        const metadeMais = tesouraria / 2n + 1n;

        const [primeira, segunda] = await Promise.all([
            approve(await propose(metadeMais.toString())),
            approve(await propose(metadeMais.toString())),
        ]);

        const aceites = [primeira, segunda].filter(
            (resposta) => resposta.statusCode === 200,
        );

        expect(aceites).toHaveLength(1);
        expect(await treasury()).toBeGreaterThanOrEqual(0n);
    });

    /**
     * Depois de tudo isto, o dinheiro que saiu da tesouraria tem de ser
     * exatamente o que entrou nas carteiras dos membros. É a conta que
     * uma comunidade faria para confirmar que ninguém ficou a perder.
     */
    it('o que saiu da tesouraria é exatamente o que os membros receberam', async () => {
        const carteira = await prisma.wallet.findFirstOrThrow({ where: { crewId } });

        const saidas = await prisma.transaction.aggregate({
            where: {
                walletId: carteira.id,
                status: 'approved',
                direction: 'debit',
                category: 'payout',
                is_deleted: false,
            },
            _sum: { amount: true },
        });

        const carteirasDosMembros = await prisma.wallet.findMany({
            where: { userId: { in: memberIds } },
            select: { id: true },
        });

        const entradas = await prisma.transaction.aggregate({
            where: {
                walletId: { in: carteirasDosMembros.map((linha) => linha.id) },
                status: 'approved',
                direction: 'credit',
                category: 'payout',
                is_deleted: false,
            },
            _sum: { amount: true },
        });

        expect(entradas._sum.amount).toBe(saidas._sum.amount);
    });

    it('o saldo da tesouraria bate certo com os seus movimentos', async () => {
        const carteira = await prisma.wallet.findFirstOrThrow({ where: { crewId } });

        const somas = await prisma.transaction.groupBy({
            by: ['direction'],
            where: { walletId: carteira.id, status: 'approved', is_deleted: false },
            _sum: { amount: true },
        });

        const recalculado = somas.reduce(
            (total, linha) =>
                linha.direction === 'credit'
                    ? total + (linha._sum.amount ?? 0n)
                    : total - (linha._sum.amount ?? 0n),
            0n,
        );

        expect(carteira.balance).toBe(recalculado);
    });
});
