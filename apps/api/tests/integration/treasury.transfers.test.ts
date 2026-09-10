import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * Um servidor a pagar às crews que lá jogam, contra PostgreSQL a sério.
 *
 * A propriedade que isto existe para fixar diz-se numa linha: **o
 * dinheiro nunca está nos dois lados nem em nenhum.** Ou sai do servidor
 * e entra na crew, ou não acontece nada — e não há forma de o observar
 * a meio.
 *
 * Não se prova com duplos. Um mock devolve o que lhe mandarem, e o que
 * aqui interessa é o que a base de dados faz quando a transação é
 * desfeita a meio por falta de saldo.
 */
describe('transferências entre tesourarias', () => {
    let app: FastifyInstance;

    const marca = `tr${Date.now().toString().slice(-8)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    /** O dono do servidor, que também lidera a crew que lá joga. */
    let dono: string;
    let serverId: string;
    /** A crew filiada, que pode receber. */
    let crewId: string;
    /** Uma crew que existe e não joga aqui. */
    let crewDeFora: string;

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

    const criarCrew = async (token: string, nome: string, tag: string) => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(token),
            payload: { name: nome, tag },
        });

        expect(response.statusCode, response.body).toBe(201);

        return response.json().id as string;
    };

    /** Enche a tesouraria do servidor pelo caminho normal. */
    const encherServidor = async (amount: string) => {
        const proposta = await app.inject({
            method: 'POST',
            url: `/api/v1/treasury/servers/${serverId}/movements`,
            headers: auth(dono),
            payload: {
                amount,
                direction: 'credit',
                category: 'contribution',
                description: 'Receita do servidor',
            },
        });

        expect(proposta.statusCode, proposta.body).toBe(201);

        const aprovacao = await app.inject({
            method: 'POST',
            url: `/api/v1/treasury/servers/${serverId}/movements/${proposta.json().id}/approve`,
            headers: auth(dono),
        });

        expect(aprovacao.statusCode, aprovacao.body).toBe(200);
    };

    const transferir = (payload: Record<string, unknown>, token = dono) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/treasury/servers/${serverId}/transfers`,
            headers: auth(token),
            payload,
        });

    const saldos = async () => {
        const [servidor, crew] = await Promise.all([
            prisma.wallet.findFirstOrThrow({
                where: { serverId },
                select: { balance: true },
            }),
            prisma.wallet.findFirstOrThrow({
                where: { crewId },
                select: { balance: true },
            }),
        ]);

        return { servidor: servidor.balance, crew: crew.balance };
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        dono = await register(`tr${marca}`);

        const servidor = await app.inject({
            method: 'POST',
            url: '/api/v1/servers',
            headers: auth(dono),
            payload: { name: `Servidor ${marca}` },
        });

        expect(servidor.statusCode, servidor.body).toBe(201);
        serverId = servidor.json().id as string;

        crewId = await criarCrew(dono, `Crew ${marca}`, `A${marca.slice(-6)}`);
        crewDeFora = await criarCrew(dono, `Fora ${marca}`, `B${marca.slice(-6)}`);

        /** A crew pede para jogar no servidor, e o servidor aceita. */
        const pedido = await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/affiliation`,
            headers: auth(dono),
            payload: { serverId },
        });

        expect(pedido.statusCode, pedido.body).toBe(201);

        const aceite = await app.inject({
            method: 'POST',
            url: `/api/v1/servers/${serverId}/affiliations/${crewId}/accept`,
            headers: auth(dono),
        });

        expect(aceite.statusCode, aceite.body).toBe(200);

        await encherServidor('10000');
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('move o dinheiro de uma tesouraria para a outra', async () => {
        const antes = await saldos();

        const response = await transferir({
            crewId,
            amount: '2500',
            description: 'Pagamento aos atores do evento',
        });

        expect(response.statusCode, response.body).toBe(201);

        const depois = await saldos();

        expect(depois.servidor).toBe(antes.servidor - 2500n);
        expect(depois.crew).toBe(antes.crew + 2500n);
    });

    /**
     * As duas pernas existem, somam o mesmo, e estão ligadas.
     *
     * É isto que permite, meses depois, olhar para um crédito na crew e
     * dizer de que servidor veio — e para um débito no servidor e dizer
     * para onde foi.
     */
    it('deixa duas linhas ligadas pelo mesmo identificador', async () => {
        const response = await transferir({ crewId, amount: '1000' });

        expect(response.statusCode, response.body).toBe(201);

        const { transferId } = response.json() as { transferId: string };

        const pernas = await prisma.transaction.findMany({
            where: { transferId },
            select: { direction: true, amount: true, status: true },
            orderBy: { direction: 'asc' },
        });

        expect(pernas).toHaveLength(2);
        expect(pernas.map((perna) => perna.direction)).toEqual([
            'credit',
            'debit',
        ]);
        expect(new Set(pernas.map((perna) => perna.amount))).toEqual(
            new Set([1000n]),
        );
        expect(new Set(pernas.map((perna) => perna.status))).toEqual(
            new Set(['approved']),
        );
    });

    /**
     * O caso que justifica a transação: sem saldo, **nada** acontece.
     *
     * Não basta a resposta ser 409. O que se prova é que os dois saldos
     * ficaram exatamente onde estavam e que não sobrou meia linha — um
     * débito sem crédito seria dinheiro desaparecido, e ninguém
     * conseguiria dizer para onde.
     */
    it('sem saldo não mexe em nada dos dois lados', async () => {
        const antes = await saldos();

        const linhasAntes = await prisma.transaction.count({
            where: { transferId: { not: null } },
        });

        const response = await transferir({ crewId, amount: '999999999' });

        expect(response.statusCode, response.body).toBe(409);
        expect(response.json().code).toBe('INSUFFICIENT_FUNDS');

        expect(await saldos()).toEqual(antes);

        expect(
            await prisma.transaction.count({
                where: { transferId: { not: null } },
            }),
        ).toBe(linhasAntes);
    });

    /**
     * Sem isto, quem manda num servidor empurrava dinheiro para qualquer
     * crew da plataforma.
     *
     * A resposta é 404 e não 403 de propósito: quem manda no servidor não
     * tem por que saber que aquela crew existe, e dizer "existe mas não
     * joga aqui" transformava esta rota num verificador de nomes.
     */
    it('recusa uma crew que não joga neste servidor', async () => {
        const antes = await saldos();

        const response = await transferir({ crewId: crewDeFora, amount: '100' });

        expect(response.statusCode, response.body).toBe(404);
        expect(response.json().code).toBe('CREW_DOES_NOT_PLAY_HERE');

        expect(await saldos()).toEqual(antes);
    });

    it('recusa a quem não manda na tesouraria do servidor', async () => {
        const estranho = await register(`es${marca}`);

        const antes = await saldos();

        const response = await transferir({ crewId, amount: '100' }, estranho);

        expect(response.statusCode, response.body).toBe(403);
        expect(await saldos()).toEqual(antes);
    });

    /**
     * O dinheiro chega já liquidado, e não à espera de resposta.
     *
     * Receber não é um fardo que se recuse, e pôr a transferência a
     * aguardar deixava o saldo de quem pagou por liquidar à espera de
     * alguém que não tem nada a decidir. O que fica por aprovar é a
     * distribuição a seguir.
     */
    it('o dinheiro fica disponível na crew de imediato', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/treasury/crews/${crewId}`,
            headers: auth(dono),
        });

        expect(response.statusCode, response.body).toBe(200);

        const { balances } = response.json() as {
            balances: { settled: string; available: string; pendingIn: string };
        };

        /**
         * Liquidado, e não pendente: é essa a diferença entre um
         * pagamento que chegou e um que está à espera de alguém.
         */
        expect(BigInt(balances.settled)).toBeGreaterThan(0n);
        expect(balances.available).toBe(balances.settled);
        expect(balances.pendingIn).toBe('0');
    });
});
