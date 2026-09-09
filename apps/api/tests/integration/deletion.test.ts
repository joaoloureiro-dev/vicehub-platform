import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma, SubscriptionPlan, SubscriptionStatus } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * Apagar uma crew ou um servidor, contra PostgreSQL a sério.
 *
 * O que aqui interessa provar é o que não se vê no caminho feliz:
 *
 * — que o **nome volta**. É a razão de isto existir. Os nomes são
 *   únicos, e até aqui quem criasse uma crew com o nome trocado ficava
 *   com ele ocupado para sempre, incluindo para si próprio. A unicidade
 *   passou a ser um índice parcial, e um índice parcial ou está certo ou
 *   deixa entrar duas crews vivas com o mesmo nome — não há meio termo,
 *   e não se descobre qual dos dois é sem uma base de dados a sério.
 *
 * — que **o que dependia da coisa apagada deixa de valer**: adesões,
 *   filiações, chaves de ingestão.
 *
 * — que **não se apaga por cima de dinheiro**.
 */
describe('apagar crews e servidores', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });
    const comChave = (chave: string) => ({ authorization: `Bearer ${chave}` });

    let dono: string;
    let outro: string;

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

    const criarCrew = async (
        token: string,
        nome: string,
        tag: string,
    ): Promise<number | string> => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(token),
            payload: { name: nome, tag },
        });

        return response.statusCode === 201
            ? (response.json().id as string)
            : response.statusCode;
    };

    const criarServidor = async (
        token: string,
        nome: string,
    ): Promise<number | string> => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/servers',
            headers: auth(token),
            payload: { name: nome },
        });

        return response.statusCode === 201
            ? (response.json().id as string)
            : response.statusCode;
    };

    const apagarCrew = (token: string, crewId: string) =>
        app.inject({
            method: 'DELETE',
            url: `/api/v1/crews/${crewId}`,
            headers: auth(token),
        });

    const apagarServidor = (token: string, serverId: string) =>
        app.inject({
            method: 'DELETE',
            url: `/api/v1/servers/${serverId}`,
            headers: auth(token),
        });

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        dono = await register(`apg${marca}`);
        outro = await register(`apo${marca}`);
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    describe('o nome volta a ficar livre', () => {
        it('deixa criar outra crew com o nome e a tag da que foi apagada', async () => {
            const nome = `Enganei-me ${marca}`;
            const tag = `E${marca.slice(-6)}`;

            const primeira = await criarCrew(dono, nome, tag);

            expect(typeof primeira).toBe('string');

            /* Antes disto, o nome ficava ocupado para sempre. */
            expect(await criarCrew(outro, nome, tag)).toBe(409);

            expect((await apagarCrew(dono, primeira as string)).statusCode).toBe(
                204,
            );

            const segunda = await criarCrew(outro, nome, tag);

            expect(typeof segunda, String(segunda)).toBe('string');
            expect(segunda).not.toBe(primeira);
        });

        it('deixa criar outro servidor com o nome do que foi apagado', async () => {
            const nome = `Servidor Enganado ${marca}`;

            const primeiro = await criarServidor(dono, nome);

            expect(typeof primeiro).toBe('string');
            expect(await criarServidor(outro, nome)).toBe(409);

            expect(
                (await apagarServidor(dono, primeiro as string)).statusCode,
            ).toBe(204);

            expect(typeof (await criarServidor(outro, nome))).toBe('string');
        });

        /**
         * Duas crews vivas com o mesmo nome continuam a ser duas de
         * mais. O índice parcial deixa passar as apagadas, e nada mais.
         */
        it('continua a recusar dois nomes iguais entre as que existem', async () => {
            const nome = `Duplicada ${marca}`;

            expect(typeof (await criarCrew(dono, nome, `D1${marca.slice(-5)}`)))
                .toBe('string');

            expect(await criarCrew(outro, nome, `D2${marca.slice(-5)}`)).toBe(409);
        });
    });

    describe('o que deixa de valer', () => {
        it('tira a crew do diretório, do perfil e das minhas comunidades', async () => {
            const crewId = (await criarCrew(
                dono,
                `Some ${marca}`,
                `S${marca.slice(-6)}`,
            )) as string;

            expect((await apagarCrew(dono, crewId)).statusCode).toBe(204);

            const perfil = await app.inject({
                method: 'GET',
                url: `/api/v1/crews/${crewId}`,
            });

            expect(perfil.statusCode).toBe(404);

            const minhas = await app.inject({
                method: 'GET',
                url: '/api/v1/crews/me/memberships',
                headers: auth(dono),
            });

            expect(minhas.statusCode, minhas.body).toBe(200);
            expect(
                (minhas.json() as { crewId: string }[]).map((m) => m.crewId),
            ).not.toContain(crewId);
        });

        it('deixa a chave de ingestão de um servidor apagado sem serventia', async () => {
            const serverId = (await criarServidor(
                dono,
                `Com Chave ${marca}`,
            )) as string;

            const chave = await app.inject({
                method: 'POST',
                url: `/api/v1/servers/${serverId}/api-keys`,
                headers: auth(dono),
                payload: { label: 'produção' },
            });

            expect(chave.statusCode, chave.body).toBe(201);

            const apresentada = chave.json().key as string;

            /* Antes de apagar, a chave fala pelo servidor. */
            const antes = await app.inject({
                method: 'GET',
                url: '/api/v1/ingest/me',
                headers: comChave(apresentada),
            });

            expect(antes.statusCode, antes.body).toBe(200);

            expect((await apagarServidor(dono, serverId)).statusCode).toBe(204);

            const depois = await app.inject({
                method: 'GET',
                url: '/api/v1/ingest/me',
                headers: comChave(apresentada),
            });

            expect(depois.statusCode).toBe(401);
        });

        /**
         * Apagar o servidor desfaz a filiação das crews que lá jogavam —
         * e tem de a desfazer mesmo, e não apenas escondê-la: uma
         * filiação ativa a apontar para um servidor que já não existe
         * impedia a crew de se filiar noutro lado, por causa do índice
         * que só deixa uma filiação ativa por crew.
         */
        it('desfaz as filiações e deixa a crew filiar-se noutro sítio', async () => {
            const crewId = (await criarCrew(
                dono,
                `Filiada ${marca}`,
                `F${marca.slice(-6)}`,
            )) as string;

            const serverId = (await criarServidor(
                outro,
                `Anfitrião ${marca}`,
            )) as string;

            const segundo = (await criarServidor(
                outro,
                `Anfitrião Dois ${marca}`,
            )) as string;

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
                headers: auth(outro),
            });

            expect(aceite.statusCode, aceite.body).toBe(200);

            expect((await apagarServidor(outro, serverId)).statusCode).toBe(204);

            const estado = await app.inject({
                method: 'GET',
                url: `/api/v1/crews/${crewId}/affiliation`,
            });

            expect(estado.statusCode, estado.body).toBe(200);
            expect(estado.json().server).toBeNull();

            const novoPedido = await app.inject({
                method: 'POST',
                url: `/api/v1/crews/${crewId}/affiliation`,
                headers: auth(dono),
                payload: { serverId: segundo },
            });

            expect(novoPedido.statusCode, novoPedido.body).toBe(201);
        });
    });

    describe('o que impede', () => {
        it('recusa com 409 enquanto a tesouraria tiver saldo', async () => {
            const crewId = (await criarCrew(
                dono,
                `Com Saldo ${marca}`,
                `T${marca.slice(-6)}`,
            )) as string;

            await prisma.wallet.updateMany({
                where: { crewId },
                data: { balance: 5_000n },
            });

            const recusa = await apagarCrew(dono, crewId);

            expect(recusa.statusCode, recusa.body).toBe(409);
            expect(recusa.json().code).toBe('CREW_HAS_FUNDS');

            /* Esvaziada, apaga-se. */
            await prisma.wallet.updateMany({
                where: { crewId },
                data: { balance: 0n },
            });

            expect((await apagarCrew(dono, crewId)).statusCode).toBe(204);
        });

        it('recusa com 409 enquanto houver plano ativo', async () => {
            const crewId = (await criarCrew(
                dono,
                `Com Plano ${marca}`,
                `P${marca.slice(-6)}`,
            )) as string;

            const plano = await prisma.subscription.create({
                data: {
                    crewId,
                    plan: SubscriptionPlan.premium,
                    status: SubscriptionStatus.active,
                    price_cents: 500,
                    current_period_start: new Date(),
                    current_period_end: new Date(Date.now() + 86_400_000),
                },
            });

            const recusa = await apagarCrew(dono, crewId);

            expect(recusa.statusCode, recusa.body).toBe(409);
            expect(recusa.json().code).toBe('CREW_HAS_ACTIVE_PLAN');

            await prisma.subscription.update({
                where: { id: plano.id },
                data: { status: SubscriptionStatus.canceled, ended_at: new Date() },
            });

            expect((await apagarCrew(dono, crewId)).statusCode).toBe(204);
        });

        /**
         * Apagar é do líder, e não de quem gere membros: com
         * crew:manage_members um oficial apagava a crew de quem a
         * fundou.
         */
        it('recusa a um oficial da própria crew', async () => {
            const crewId = (await criarCrew(
                dono,
                `Com Oficial ${marca}`,
                `O${marca.slice(-6)}`,
            )) as string;

            await app.inject({
                method: 'POST',
                url: `/api/v1/crews/${crewId}/join`,
                headers: auth(outro),
            });

            const pedidos = await app.inject({
                method: 'GET',
                url: `/api/v1/crews/${crewId}/requests`,
                headers: auth(dono),
            });

            const oficialId = pedidos.json()[0].userId as string;

            await app.inject({
                method: 'POST',
                url: `/api/v1/crews/${crewId}/requests/${oficialId}/accept`,
                headers: auth(dono),
            });

            const cargo = await app.inject({
                method: 'PUT',
                url: `/api/v1/crews/${crewId}/members/${oficialId}/role`,
                headers: auth(dono),
                payload: { role: 'crew_officer' },
            });

            expect(cargo.statusCode, cargo.body).toBe(204);

            expect((await apagarCrew(outro, crewId)).statusCode).toBe(403);

            /* E ao líder continua a ser permitido. */
            expect((await apagarCrew(dono, crewId)).statusCode).toBe(204);
        });

        it('recusa a quem não tem nada a ver com a crew', async () => {
            const crewId = (await criarCrew(
                dono,
                `Alheia ${marca}`,
                `A${marca.slice(-6)}`,
            )) as string;

            expect((await apagarCrew(outro, crewId)).statusCode).toBe(403);
        });
    });
});
