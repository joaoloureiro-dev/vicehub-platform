import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * A tesouraria de uma crew é dela.
 *
 * Isto já era a intenção do desenho — a permissão é avaliada no âmbito
 * da crew que está na rota, e cada movimento é confrontado com a
 * carteira dessa crew — mas uma intenção sem teste é uma intenção que se
 * perde na próxima alteração. Aqui prova-se com dois líderes: cada um
 * manda na sua e não vê nada da do outro, nem por leitura, nem por
 * proposta, nem pondo o identificador da sua crew no caminho para
 * aprovar um movimento alheio.
 */
describe('a tesouraria não atravessa crews', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let ana: { token: string; id: string };
    let bruno: { token: string; id: string };

    let crewDaAna: string;
    let crewDoBruno: string;

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
                name: `Cofre ${marca}${sufixo}`,
                tag: `C${sufixo}${marca.slice(-4)}`,
            },
        });

        expect(response.statusCode, response.body).toBe(201);

        return response.json().id as string;
    };

    const propor = (token: string, crewId: string) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/treasury/crews/${crewId}/movements`,
            headers: auth(token),
            payload: {
                amount: '5000',
                direction: 'credit',
                category: 'other',
                description: `entrada ${marca}`,
            },
        });

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        ana = await register(`tsa${marca}`);
        bruno = await register(`tsb${marca}`);

        crewDaAna = await criarCrew(ana.token, 'a');
        crewDoBruno = await criarCrew(bruno.token, 'b');
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('cada líder lê a tesouraria da sua crew', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/treasury/crews/${crewDaAna}`,
            headers: auth(ana.token),
        });

        expect(resposta.statusCode, resposta.body).toBe(200);
    });

    it('não lê a tesouraria da crew do outro', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/treasury/crews/${crewDoBruno}`,
            headers: auth(ana.token),
        });

        expect(resposta.statusCode, resposta.body).toBe(403);
    });

    it('não propõe movimentos na tesouraria do outro', async () => {
        expect((await propor(ana.token, crewDoBruno)).statusCode).toBe(403);
    });

    /**
     * O caso que o desenho existe para impedir: aprovar um movimento da
     * crew do outro **pondo o identificador da minha no caminho**. O
     * guard das permissões só olha para o parâmetro da rota, e por isso
     * deixaria passar — o que recusa é o serviço, ao confrontar o
     * movimento com a carteira da crew que está na rota.
     */
    it('não aprova um movimento alheio pondo a sua crew no caminho', async () => {
        const proposto = await propor(bruno.token, crewDoBruno);

        expect(proposto.statusCode, proposto.body).toBe(201);

        const movementId = proposto.json().id as string;

        const atalho = await app.inject({
            method: 'POST',
            url: `/api/v1/treasury/crews/${crewDaAna}/movements/${movementId}/approve`,
            headers: auth(ana.token),
        });

        expect(atalho.statusCode, atalho.body).toBe(404);

        /* E o movimento do Bruno continua onde estava, por decidir. */
        const movimento = await prisma.transaction.findUniqueOrThrow({
            where: { id: movementId },
            select: { status: true },
        });

        expect(movimento.status).toBe('pending');
    });

    it('nem sequer com um membro comum da própria crew', async () => {
        const membro = await register(`tsm${marca}`);

        await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewDaAna}/join`,
            headers: auth(membro.token),
        });

        await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewDaAna}/requests/${membro.id}/accept`,
            headers: auth(ana.token),
        });

        /* Pertence à crew da Ana — e continua sem nada na do Bruno. */
        expect(
            (
                await app.inject({
                    method: 'GET',
                    url: `/api/v1/treasury/crews/${crewDoBruno}`,
                    headers: auth(membro.token),
                })
            ).statusCode,
        ).toBe(403);
    });
});
