import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * Testes de concorrência da tesouraria, contra PostgreSQL a sério.
 *
 * Existem porque estas garantias não são verificáveis com duplos em
 * memória: o que impede o dinheiro de sair duas vezes é uma escrita
 * condicional dentro de uma transação, e só a base de dados consegue
 * decidir quem chega primeiro.
 *
 * É a diferença entre ter verificado uma vez e continuar verificado.
 */
describe('concorrência na tesouraria', () => {
    let app: FastifyInstance;

    const marca = `conc${Date.now()}`;

    let leader: string;
    let officer: string;
    let crewId: string;

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

    const propose = async (amount: string, direction: 'credit' | 'debit') => {
        const response = await app.inject({
            method: 'POST',
            url: `/api/v1/treasury/crews/${crewId}/movements`,
            headers: auth(officer),
            payload: {
                amount,
                direction,
                category: 'other',
                description: 'Movimento de teste',
            },
        });

        expect(response.statusCode, response.body).toBe(201);

        return response.json().id as string;
    };

    const approve = (movementId: string) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/treasury/crews/${crewId}/movements/${movementId}/approve`,
            headers: auth(leader),
        });

    const settled = async (): Promise<bigint> => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/treasury/crews/${crewId}`,
            headers: auth(leader),
        });

        return BigInt(response.json().balances.settled as string);
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        leader = await register(`${marca}l`);
        officer = await register(`${marca}o`);

        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(leader),
            payload: { name: `Concorrencia ${marca}`, tag: `C${marca.slice(-5)}` },
        });

        expect(crew.statusCode, crew.body).toBe(201);
        crewId = crew.json().id as string;

        await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/join`,
            headers: auth(officer),
        });

        const pedidos = await app.inject({
            method: 'GET',
            url: `/api/v1/crews/${crewId}/requests`,
            headers: auth(leader),
        });

        const officerId = pedidos.json()[0].userId as string;

        await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/requests/${officerId}/accept`,
            headers: auth(leader),
        });

        await app.inject({
            method: 'PUT',
            url: `/api/v1/crews/${crewId}/members/${officerId}/role`,
            headers: auth(leader),
            payload: { role: 'crew_officer' },
        });

        /**
         * Uma entrada aprovada dá à tesouraria com que trabalhar.
         */
        await approve(await propose('10000', 'credit'));

        expect(await settled()).toBe(10_000n);
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    /**
     * Duas aprovações do mesmo movimento ao mesmo tempo. A escrita é
     * condicional ao estado pendente: só uma altera linha.
     */
    it('o mesmo movimento aprovado duas vezes em simultâneo só sai uma vez', async () => {
        const antes = await settled();
        const movimento = await propose('3000', 'debit');

        const [primeira, segunda] = await Promise.all([
            approve(movimento),
            approve(movimento),
        ]);

        const aceites = [primeira, segunda].filter(
            (resposta) => resposta.statusCode === 200,
        );

        expect(aceites).toHaveLength(1);
        expect(await settled()).toBe(antes - 3_000n);
    });

    /**
     * Duas saídas diferentes que, juntas, excedem o saldo. A saída é
     * condicional ao saldo chegar: a segunda desfaz-se por inteiro.
     */
    it('duas saídas que juntas excedem o saldo não passam ambas', async () => {
        const antes = await settled();
        const metadeMais = antes / 2n + 1n;

        const [primeira, segunda] = await Promise.all([
            approve(await propose(metadeMais.toString(), 'debit')),
            approve(await propose(metadeMais.toString(), 'debit')),
        ]);

        const aceites = [primeira, segunda].filter(
            (resposta) => resposta.statusCode === 200,
        );

        expect(aceites).toHaveLength(1);
        expect(await settled()).toBe(antes - metadeMais);
    });

    it('o saldo nunca fica negativo, faça-se o que se fizer', async () => {
        const antes = await settled();

        const movimentos = await Promise.all(
            Array.from({ length: 5 }, () => propose((antes + 1n).toString(), 'debit')),
        );

        await Promise.all(movimentos.map((movimento) => approve(movimento)));

        expect(await settled()).toBeGreaterThanOrEqual(0n);
        expect(await settled()).toBe(antes);
    });

    /**
     * O saldo guardado na carteira é uma cache mantida por quem aprova.
     * Depois de tudo isto, tem de continuar a bater certo com a soma das
     * próprias movimentações.
     */
    it('o saldo guardado bate certo com os movimentos aprovados', async () => {
        const wallet = await prisma.wallet.findFirstOrThrow({ where: { crewId } });

        const somas = await prisma.transaction.groupBy({
            by: ['direction'],
            where: { walletId: wallet.id, status: 'approved', is_deleted: false },
            _sum: { amount: true },
        });

        const recalculado = somas.reduce(
            (total, linha) =>
                linha.direction === 'credit'
                    ? total + (linha._sum.amount ?? 0n)
                    : total - (linha._sum.amount ?? 0n),
            0n,
        );

        expect(wallet.balance).toBe(recalculado);
    });
});
