import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * A candidatura, das palavras de quem a escreve até aos olhos de quem
 * decide.
 *
 * Pedir entrada era um botão que não mandava nada: do outro lado
 * aparecia um nome numa lista, e quem decidia escolhia entre aceitar um
 * desconhecido ou recusar um desconhecido.
 *
 * O que estes testes fixam é o caminho inteiro — o que se escreve chega
 * intacto, chega **só a quem manda na crew**, e continua lá depois de
 * respondido.
 */
describe('a candidatura a uma crew', () => {
    let app: FastifyInstance;

    const marca = `ap${Date.now().toString().slice(-8)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let lider: string;
    let candidato: string;
    let estranho: string;
    let crewId: string;

    const CARTA = 'Tenho 22 anos, jogo à noite\ne uso microfone.';

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

    const candidatar = (token: string, payload?: Record<string, unknown>) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/join`,
            headers: auth(token),
            ...(payload === undefined ? {} : { payload }),
        });

    const listar = (token: string) =>
        app.inject({
            method: 'GET',
            url: `/api/v1/crews/${crewId}/requests`,
            headers: auth(token),
        });

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        lider = await register(`li${marca}`);
        candidato = await register(`ca${marca}`);
        estranho = await register(`es${marca}`);

        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(lider),
            payload: { name: `Crew ${marca}`, tag: `C${marca.slice(-6)}` },
        });

        expect(crew.statusCode, crew.body).toBe(201);
        crewId = crew.json().id as string;
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('leva o que a pessoa escreveu até quem decide', async () => {
        expect((await candidatar(candidato, { message: CARTA })).statusCode).toBe(202);

        const resposta = await listar(lider);

        expect(resposta.statusCode, resposta.body).toBe(200);

        const pedidos = resposta.json() as { username: string; message: string | null }[];
        const meu = pedidos.find((pedido) => pedido.username === `ca${marca}`);

        expect(meu?.message).toBe(CARTA);
    });

    /**
     * As quebras de linha contam. Uma candidatura chega quase sempre em
     * parágrafos, e achatá-la numa linha só faz de um texto pensado uma
     * papa que ninguém lê.
     */
    it('não achata o que foi escrito em várias linhas', async () => {
        const pedidos = (await listar(lider)).json() as { message: string | null }[];

        expect(pedidos.some((pedido) => pedido.message?.includes('\n'))).toBe(true);
    });

    /**
     * A carta é para quem decide, e não para o diretório.
     *
     * Alguém escreve ali coisas sobre si — idade, horários, por vezes o
     * país. Isso é para os olhos de quem responde à candidatura, e de
     * mais ninguém.
     */
    it('não a mostra a quem não manda na crew', async () => {
        const resposta = await listar(estranho);

        expect(resposta.statusCode).toBe(403);
    });

    it('nem a quem nem sessão tem', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/crews/${crewId}/requests`,
        });

        expect(resposta.statusCode).toBe(401);
    });

    /**
     * Escrever é opcional. Uma crew sem requisitos escritos não tem por
     * que exigir uma redação, e obrigar a escrever punha uma porta onde
     * não havia nenhuma.
     */
    it('deixa candidatar-se sem escrever nada', async () => {
        const outro = await register(`ou${marca}`);

        expect((await candidatar(outro)).statusCode).toBe(202);

        const pedidos = (await listar(lider)).json() as {
            username: string;
            message: string | null;
        }[];

        expect(
            pedidos.find((pedido) => pedido.username === `ou${marca}`)?.message,
        ).toBeNull();
    });

    /**
     * Aceitar não apaga a carta. É o que permite, meses depois,
     * perceber com que ideia é que alguém entrou.
     */
    it('guarda-a depois de a candidatura ser aceite', async () => {
        const userId = await prisma.user
            .findFirstOrThrow({
                where: { username: `ca${marca}` },
                select: { id: true },
            })
            .then((utilizador) => utilizador.id);

        const aceite = await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/requests/${userId}/accept`,
            headers: auth(lider),
        });

        expect(aceite.statusCode, aceite.body).toBe(204);

        const adesao = await prisma.membership.findFirstOrThrow({
            where: { crewId, userId, is_deleted: false },
            select: { status: true, message: true },
        });

        expect(adesao.status).toBe('active');
        expect(adesao.message).toBe(CARTA);
    });

    it('recusa uma carta absurdamente longa', async () => {
        const outro = await register(`lo${marca}`);

        const resposta = await candidatar(outro, { message: 'x'.repeat(2001) });

        expect(resposta.statusCode).toBe(400);

        expect(
            await prisma.membership.count({
                where: {
                    crewId,
                    user: { username: `lo${marca}` },
                    is_deleted: false,
                },
            }),
        ).toBe(0);
    });
});
