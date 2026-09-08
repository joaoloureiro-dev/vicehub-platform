import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * Guardar as definições de uma crew ou de um servidor, contra
 * PostgreSQL a sério.
 *
 * Estes testes existem por causa de um erro que nenhum duplo apanhava: a
 * verificação de nome repetido não excluía o próprio registo, e por isso
 * guardar um formulário sem lhe tocar no nome respondia 409 — recusado
 * pelo próprio. Só apareceu quando passou a haver ecrã de definições,
 * porque um formulário envia sempre todos os campos, mudados ou não.
 *
 * Daí serem pedidos verdadeiros: o que se quer provar é o que a base de
 * dados responde a um nome, e um mock responde o que lhe mandarem.
 */
describe('definições de crews e servidores', () => {
    let app: FastifyInstance;

    /**
     * Os nomes de crews e de servidores são únicos em toda a plataforma,
     * pelo que cada corrida precisa dos seus. O fim do relógio muda a
     * cada milissegundo e o aleatório cobre duas corridas no mesmo; o
     * princípio do relógio não muda há anos, e usá-lo faria o teste
     * passar na primeira corrida e falhar na segunda. São sete
     * caracteres porque a tag de uma crew só aceita oito.
     */
    const marca = `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let dono: string;
    let crewId: string;
    let serverId: string;
    let outraCrew: string;
    let outroServer: string;

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

    const criarServidor = async (token: string, nome: string) => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/servers',
            headers: auth(token),
            payload: { name: nome },
        });

        expect(response.statusCode, response.body).toBe(201);

        return response.json().id as string;
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        dono = await register(`set${marca}`);
        const alheio = await register(`alh${marca}`);

        crewId = await criarCrew(dono, `Crew ${marca}`, `C${marca}`);
        serverId = await criarServidor(dono, `Server ${marca}`);

        outraCrew = `Crew alheia ${marca}`;
        outroServer = `Server alheio ${marca}`;

        await criarCrew(alheio, outraCrew, `A${marca}`);
        await criarServidor(alheio, outroServer);
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    describe('crew', () => {
        it('aceita o próprio nome de volta e grava o resto', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: `/api/v1/crews/${crewId}`,
                headers: auth(dono),
                payload: { name: `Crew ${marca}`, description: 'com definições' },
            });

            expect(response.statusCode, response.body).toBe(200);
            expect(response.json().description).toBe('com definições');
        });

        it('continua a recusar o nome de outra crew', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: `/api/v1/crews/${crewId}`,
                headers: auth(dono),
                payload: { name: outraCrew },
            });

            expect(response.statusCode, response.body).toBe(409);
            expect(response.json().code).toBe('CREW_NAME_TAKEN');
        });

        /**
         * O nome recusado não pode ter deixado rasto: um 409 com a
         * descrição já gravada seria pior do que não haver verificação,
         * porque metade do formulário passava.
         */
        it('não grava nada quando recusa o nome', async () => {
            await app.inject({
                method: 'PATCH',
                url: `/api/v1/crews/${crewId}`,
                headers: auth(dono),
                payload: { name: outraCrew, description: 'não deve ficar' },
            });

            const crew = await prisma.crew.findFirstOrThrow({
                where: { id: crewId },
                select: { name: true, description: true },
            });

            expect(crew).toEqual({
                name: `Crew ${marca}`,
                description: 'com definições',
            });
        });

        it('limpa a descrição com null', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: `/api/v1/crews/${crewId}`,
                headers: auth(dono),
                payload: { name: `Crew ${marca}`, description: null },
            });

            expect(response.statusCode, response.body).toBe(200);
            expect(response.json().description).toBeNull();
        });
    });

    describe('servidor', () => {
        it('aceita o próprio nome de volta e grava o resto', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: `/api/v1/servers/${serverId}`,
                headers: auth(dono),
                payload: {
                    name: `Server ${marca}`,
                    region: 'EU',
                    description: 'com definições',
                    isOnline: true,
                },
            });

            expect(response.statusCode, response.body).toBe(200);
            expect(response.json()).toMatchObject({
                name: `Server ${marca}`,
                region: 'EU',
                description: 'com definições',
                isOnline: true,
            });
        });

        it('continua a recusar o nome de outro servidor', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: `/api/v1/servers/${serverId}`,
                headers: auth(dono),
                payload: { name: outroServer },
            });

            expect(response.statusCode, response.body).toBe(409);
            expect(response.json().code).toBe('SERVER_NAME_TAKEN');
        });

        it('não grava nada quando recusa o nome', async () => {
            await app.inject({
                method: 'PATCH',
                url: `/api/v1/servers/${serverId}`,
                headers: auth(dono),
                payload: { name: outroServer, isOnline: false },
            });

            const server = await prisma.server.findFirstOrThrow({
                where: { id: serverId },
                select: { name: true, isOnline: true },
            });

            expect(server).toEqual({
                name: `Server ${marca}`,
                isOnline: true,
            });
        });

        it('desliga o servidor sem mexer no nome', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: `/api/v1/servers/${serverId}`,
                headers: auth(dono),
                payload: { name: `Server ${marca}`, isOnline: false },
            });

            expect(response.statusCode, response.body).toBe(200);
            expect(response.json().isOnline).toBe(false);
        });
    });
});
