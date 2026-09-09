import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * Amizades, contra PostgreSQL a sério.
 *
 * Uma amizade é **uma** relação entre duas pessoas. O que aqui interessa
 * provar é que o par não tem dois sentidos: pedir a quem já nos pediu
 * encontra o pedido que lá está em vez de criar um segundo, e ninguém
 * fica amigo de alguém que não é amigo dele. Isso é uma promessa da base
 * — um CHECK e um índice parcial — e uma promessa da base só se verifica
 * contra uma base.
 */
describe('amizades', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let ana: { token: string; id: string };
    let bruno: { token: string; id: string };
    let carla: { token: string; id: string };

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

    const pedir = (quem: string, aQuem: string) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/friends/${aQuem}`,
            headers: auth(quem),
        });

    const aceitar = (quem: string, deQuem: string) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/friends/${deQuem}/accept`,
            headers: auth(quem),
        });

    const desfazer = (quem: string, comQuem: string) =>
        app.inject({
            method: 'DELETE',
            url: `/api/v1/friends/${comQuem}`,
            headers: auth(quem),
        });

    const amigosDe = async (quem: string) => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/friends',
            headers: auth(quem),
        });

        expect(response.statusCode, response.body).toBe(200);

        return response.json() as { userId: string; username: string }[];
    };

    const pedidosDe = async (quem: string) => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/friends/requests',
            headers: auth(quem),
        });

        expect(response.statusCode, response.body).toBe(200);

        return response.json() as {
            userId: string;
            direction: 'incoming' | 'outgoing';
        }[];
    };

    /** Quantas linhas existem entre duas pessoas, em qualquer estado. */
    const linhasEntre = (um: string, outro: string) =>
        prisma.friendship.count({
            where: {
                OR: [
                    { userAId: um, userBId: outro },
                    { userAId: outro, userBId: um },
                ],
            },
        });

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        ana = await register(`ama${marca}`);
        bruno = await register(`amb${marca}`);
        carla = await register(`amc${marca}`);
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    describe('o par não tem dois sentidos', () => {
        it('um pedido cria uma linha só, e aparece dos dois lados', async () => {
            expect((await pedir(ana.token, bruno.id)).statusCode).toBe(201);

            expect(await linhasEntre(ana.id, bruno.id)).toBe(1);

            const daAna = await pedidosDe(ana.token);
            const doBruno = await pedidosDe(bruno.token);

            expect(daAna).toHaveLength(1);
            expect(daAna[0]?.direction).toBe('outgoing');

            expect(doBruno).toHaveLength(1);
            expect(doBruno[0]?.direction).toBe('incoming');
        });

        /**
         * Querer os dois é ser amigo. Obrigar a pessoa a ir procurar o
         * pedido que já lá estava seria fazê-la dizer a mesma coisa por
         * outro caminho — e, pior, criar uma segunda linha.
         */
        it('pedir a quem já me pediu aceita o pedido dele', async () => {
            const resposta = await pedir(bruno.token, ana.id);

            expect(resposta.statusCode, resposta.body).toBe(200);
            expect(resposta.json().resultado).toBe('accepted');

            expect(await linhasEntre(ana.id, bruno.id)).toBe(1);

            expect((await amigosDe(ana.token)).map((a) => a.userId)).toContain(
                bruno.id,
            );
            expect((await amigosDe(bruno.token)).map((a) => a.userId)).toContain(
                ana.id,
            );
        });

        it('não deixa pedir a quem já é amigo', async () => {
            const resposta = await pedir(ana.token, bruno.id);

            expect(resposta.statusCode).toBe(409);
            expect(resposta.json().code).toBe('ALREADY_FRIENDS');
        });

        it('não deixa pedir duas vezes à mesma pessoa', async () => {
            expect((await pedir(ana.token, carla.id)).statusCode).toBe(201);

            const repetido = await pedir(ana.token, carla.id);

            expect(repetido.statusCode).toBe(409);
            expect(repetido.json().code).toBe('ALREADY_REQUESTED');
            expect(await linhasEntre(ana.id, carla.id)).toBe(1);
        });
    });

    describe('quem responde', () => {
        it('quem pediu não se aceita a si próprio', async () => {
            const resposta = await aceitar(ana.token, carla.id);

            expect(resposta.statusCode).toBe(409);
            expect(resposta.json().code).toBe('CANNOT_ACCEPT_OWN_REQUEST');
        });

        it('quem recebeu aceita', async () => {
            expect((await aceitar(carla.token, ana.id)).statusCode).toBe(204);

            expect((await amigosDe(carla.token)).map((a) => a.userId)).toContain(
                ana.id,
            );
        });

        it('desfazer tira das duas listas', async () => {
            expect((await desfazer(carla.token, ana.id)).statusCode).toBe(204);

            expect(
                (await amigosDe(ana.token)).map((a) => a.userId),
            ).not.toContain(carla.id);
            expect(
                (await amigosDe(carla.token)).map((a) => a.userId),
            ).not.toContain(ana.id);
        });

        /**
         * Dizer que não hoje não fecha a porta para sempre — é a mesma
         * decisão que já se tomou nas filiações.
         */
        it('depois de desfeita, pode-se pedir outra vez', async () => {
            expect((await pedir(ana.token, carla.id)).statusCode).toBe(201);

            /* Agora há duas linhas: a antiga, desfeita, e a nova. */
            expect(await linhasEntre(ana.id, carla.id)).toBe(2);
        });

        it('recusar não deixa a pessoa amiga', async () => {
            expect((await desfazer(carla.token, ana.id)).statusCode).toBe(204);

            expect(
                (await amigosDe(ana.token)).map((a) => a.userId),
            ).not.toContain(carla.id);
        });

        it('não há nada a responder quando não há pedido', async () => {
            const resposta = await aceitar(bruno.token, carla.id);

            expect(resposta.statusCode).toBe(404);
            expect(resposta.json().code).toBe('FRIENDSHIP_NOT_FOUND');
        });
    });

    describe('o que a base não deixa acontecer', () => {
        it('ninguém é amigo de si próprio', async () => {
            const resposta = await pedir(ana.token, ana.id);

            expect(resposta.statusCode).toBe(409);
            expect(resposta.json().code).toBe('CANNOT_FRIEND_SELF');
        });

        it('não se pede a quem não existe', async () => {
            const resposta = await pedir(
                ana.token,
                '00000000-0000-4000-8000-000000000000',
            );

            expect(resposta.statusCode).toBe(404);
        });

        it('exige sessão', async () => {
            const resposta = await app.inject({
                method: 'GET',
                url: '/api/v1/friends',
            });

            expect(resposta.statusCode).toBe(401);
        });
    });
});
