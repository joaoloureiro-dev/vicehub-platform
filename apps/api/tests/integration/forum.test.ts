import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { CORPO_MINIMO, TITULO_MINIMO, prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * O fórum, contra PostgreSQL a sério.
 *
 * É o primeiro sítio da plataforma onde o público escreve texto que
 * outras pessoas leem, e é isso que decide o que aqui se verifica: quem
 * pode escrever, quem pode retirar o que está escrito, e o que acontece
 * ao texto de alguém que apaga a conta.
 */
describe('o fórum', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let ana: { token: string; id: string; nome: string };
    let bruno: { token: string; id: string; nome: string };
    let moderador: { token: string; id: string; nome: string };

    const registar = async (nome: string) => {
        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: `${nome}@vicehub.test`,
                username: nome,
                password: 'Sup3rS3cret!Pass',
            },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return {
            token: resposta.json().accessToken as string,
            id: resposta.json().user.id as string,
            nome,
        };
    };

    const abrir = async (
        quem: { token: string },
        titulo = `Como divido os ganhos de um assalto ${marca}?`,
        corpo = 'Somos cinco e o líder quer levar mais. Como se faz isso aqui?',
    ) => {
        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/forum/topics',
            headers: auth(quem.token),
            payload: { title: titulo, body: corpo },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return resposta.json().id as string;
    };

    const responder = async (
        quem: { token: string },
        topicId: string,
        corpo = 'Confirmas as presenças e depois divides por participação.',
    ) => {
        const resposta = await app.inject({
            method: 'POST',
            url: `/api/v1/forum/topics/${topicId}/replies`,
            headers: auth(quem.token),
            payload: { body: corpo },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return resposta.json().id as string;
    };

    const ler = async (topicId: string) => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/forum/topics/${topicId}`,
        });

        expect(resposta.statusCode, resposta.body).toBe(200);

        return resposta.json() as {
            title: string;
            body: string | null;
            author: { username: string } | null;
            replies: { id: string; body: string | null }[];
        };
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        ana = await registar(`fa${marca}`);
        bruno = await registar(`fb${marca}`);
        moderador = await registar(`fm${marca}`);

        /**
         * O cargo de moderador não se alcança pela API, tal como o de
         * administrador: dá-se pela base de dados. É o que este teste
         * precisa de exercitar, e é assim que se dá na vida real.
         */
        const cargo = await prisma.role.findFirstOrThrow({
            where: { slug: 'moderator' },
            select: { id: true },
        });

        await prisma.userRole.create({
            data: { userId: moderador.id, roleId: cargo.id },
        });
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    /**
     * Ler não pede sessão, e é a decisão que faz o fórum valer a pena:
     * uma pergunta respondida serve sobretudo quem chega de uma pesquisa
     * sem conta nenhuma.
     */
    it('deixa ler sem sessão', async () => {
        const topicId = await abrir(ana);

        const semSessao = await app.inject({
            method: 'GET',
            url: `/api/v1/forum/topics/${topicId}`,
        });

        expect(semSessao.statusCode).toBe(200);
        expect(semSessao.json().title).toContain('Como divido');

        const lista = await app.inject({
            method: 'GET',
            url: '/api/v1/forum/topics',
        });

        expect(lista.statusCode).toBe(200);
        expect(lista.json().total).toBeGreaterThan(0);
    });

    it('não deixa escrever sem sessão', async () => {
        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/forum/topics',
            payload: { title: 'Uma pergunta qualquer', body: 'Com corpo suficiente.' },
        });

        expect(resposta.statusCode).toBe(401);
    });

    it('guarda a pergunta e quem a fez', async () => {
        const topicId = await abrir(ana);
        const topico = await ler(topicId);

        expect(topico.author?.username).toBe(ana.nome);
        expect(topico.body).toContain('Somos cinco');
    });

    it('deixa outra pessoa responder', async () => {
        const topicId = await abrir(ana);
        await responder(bruno, topicId);

        const topico = await ler(topicId);

        expect(topico.replies).toHaveLength(1);
        expect(topico.replies[0]?.body).toContain('Confirmas as presenças');
    });

    /**
     * Retirar o que se escreveu é o caso mais comum de todos, e uma
     * pessoa espera poder fazê-lo sem pedir a ninguém.
     */
    it('deixa cada pessoa retirar o que escreveu', async () => {
        const topicId = await abrir(ana);

        const resposta = await app.inject({
            method: 'DELETE',
            url: `/api/v1/forum/topics/${topicId}`,
            headers: auth(ana.token),
        });

        expect(resposta.statusCode, resposta.body).toBe(204);

        const depois = await app.inject({
            method: 'GET',
            url: `/api/v1/forum/topics/${topicId}`,
        });

        expect(depois.statusCode).toBe(404);
    });

    /** E não deixa retirar o que é de outra pessoa. */
    it('não deixa ninguém retirar o que não escreveu', async () => {
        const topicId = await abrir(ana);

        const resposta = await app.inject({
            method: 'DELETE',
            url: `/api/v1/forum/topics/${topicId}`,
            headers: auth(bruno.token),
        });

        expect(resposta.statusCode).toBe(403);
        expect(resposta.json().code).toBe('NOT_YOURS');
    });

    /**
     * Menos quem modera. É a razão de a permissão existir, e o caso que
     * separa um fórum de um mural.
     */
    it('deixa quem modera retirar o que é de outra pessoa', async () => {
        const topicId = await abrir(ana);

        const resposta = await app.inject({
            method: 'DELETE',
            url: `/api/v1/forum/topics/${topicId}`,
            headers: auth(moderador.token),
        });

        expect(resposta.statusCode, resposta.body).toBe(204);
    });

    it('deixa quem modera retirar uma resposta de outra pessoa', async () => {
        const topicId = await abrir(ana);
        const replyId = await responder(bruno, topicId);

        const resposta = await app.inject({
            method: 'DELETE',
            url: `/api/v1/forum/replies/${replyId}`,
            headers: auth(moderador.token),
        });

        expect(resposta.statusCode, resposta.body).toBe(204);

        const topico = await ler(topicId);

        expect(topico.replies).toHaveLength(0);
    });

    /**
     * Retirar o tópico não apaga as respostas de outras pessoas da base
     * de dados: fica marcado, e o registo de que houve ali uma pergunta
     * é o que permite a um moderador explicar-se mais tarde.
     */
    it('retira sem apagar o que lá estava', async () => {
        const topicId = await abrir(ana);
        await responder(bruno, topicId);

        await app.inject({
            method: 'DELETE',
            url: `/api/v1/forum/topics/${topicId}`,
            headers: auth(moderador.token),
        });

        const linha = await prisma.forumTopic.findUniqueOrThrow({
            where: { id: topicId },
            select: { is_deleted: true, title: true },
        });

        expect(linha.is_deleted).toBe(true);
        expect(linha.title).toContain('Como divido');
    });

    describe('o que se escreve', () => {
        it.each([
            ['título curto de mais', { title: 'Ajuda', body: 'Um corpo com tamanho suficiente.' }],
            ['corpo curto de mais', { title: 'Uma pergunta como deve ser', body: 'ajuda' }],
            ['título só com espaços', { title: '            ', body: 'Um corpo com tamanho suficiente.' }],
            ['corpo só com quebras', { title: 'Uma pergunta como deve ser', body: '\n\n\n\n\n\n\n\n\n\n\n\n\n\n' }],
        ])('recusa %s', async (_nome, payload) => {
            const resposta = await app.inject({
                method: 'POST',
                url: '/api/v1/forum/topics',
                headers: auth(ana.token),
                payload,
            });

            expect(resposta.statusCode, resposta.body).toBe(400);
        });

        /**
         * O texto é medido **depois** de arrumado. Sem isso, quebras de
         * linha a mais passavam o mínimo: contava-se o que não se ia
         * guardar.
         */
        it('mede o texto depois de o arrumar, e não antes', async () => {
            const comEnchimento = `ajuda${'\n'.repeat(40)}`;

            expect(comEnchimento.length).toBeGreaterThan(CORPO_MINIMO);

            const resposta = await app.inject({
                method: 'POST',
                url: '/api/v1/forum/topics',
                headers: auth(ana.token),
                payload: {
                    title: `Uma pergunta com tamanho ${marca}`,
                    body: comEnchimento,
                },
            });

            expect(resposta.statusCode, resposta.body).toBe(400);
        });

        /**
         * E o que a pessoa escreveu fica letra por letra, sinais de
         * maior e de menor incluídos. Alguém a explicar um erro de
         * configuração precisa de os poder escrever, e a segurança está
         * em isto ser mostrado como texto — nunca como HTML.
         */
        it('guarda o texto tal e qual, marcação incluída', async () => {
            const comSinais = 'Tenho <b>isto</b> no ficheiro e dá erro. O que é?';

            const topicId = await abrir(
                ana,
                `Que erro é este no ficheiro ${marca}?`,
                comSinais,
            );

            expect((await ler(topicId)).body).toBe(comSinais);
        });

        it('aceita um título no limite exato', async () => {
            const resposta = await app.inject({
                method: 'POST',
                url: '/api/v1/forum/topics',
                headers: auth(ana.token),
                payload: {
                    title: 'a'.repeat(TITULO_MINIMO),
                    body: 'Um corpo com tamanho suficiente para passar.',
                },
            });

            expect(resposta.statusCode, resposta.body).toBe(201);
        });
    });

    /**
     * A promessa que a plataforma já faz a quem apaga a conta: **o teu
     * texto é apagado**. O que se escreve no fórum é texto seu, e muitas
     * vezes com mais da pessoa lá dentro do que a biografia teve.
     */
    describe('quando alguém apaga a conta', () => {
        it('retira o texto e deixa a conversa de pé', async () => {
            const sai = await registar(`fs${marca}`);

            const topicId = await abrir(
                sai,
                `Uma pergunta de quem vai sair ${marca}`,
                'Isto é uma coisa pessoal que escrevi e não quero deixar cá.',
            );

            await responder(bruno, topicId, 'Uma resposta de outra pessoa.');

            const saida = await app.inject({
                method: 'DELETE',
                url: '/api/v1/users/me',
                headers: auth(sai.token),
                payload: {
                    confirmation: sai.nome,
                    password: 'Sup3rS3cret!Pass',
                },
            });

            expect(saida.statusCode, saida.body).toBe(204);

            const topico = await ler(topicId);

            /* O texto foi-se. */
            expect(topico.body).toBeNull();

            /* O tópico ficou, e a resposta de outra pessoa com ele. */
            expect(topico.title).toContain('quem vai sair');
            expect(topico.replies).toHaveLength(1);
            expect(topico.replies[0]?.body).toBe('Uma resposta de outra pessoa.');
        });
    });
});
