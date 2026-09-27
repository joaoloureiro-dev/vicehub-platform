import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * A resposta que resolveu, contra PostgreSQL a sério.
 *
 * O que só aqui se prova é o que a base garante e o código não tem de
 * lembrar-se de verificar: o apontador está no tópico e é único, por
 * isso marcar outra desmarca a anterior sem ninguém o fazer. Um duplo
 * diria que o `update` foi chamado.
 *
 * E prova-se a regra que **não** está na base: retirar a resposta
 * aceite tem de limpar a marca. O `ON DELETE SET NULL` só trata do
 * apagar a sério, e o apagar deste produto é brando.
 */
describe('a resposta que resolveu', () => {
    let app: FastifyInstance;

    const marca = `ac${Date.now().toString().slice(-7)}`;
    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let quemPergunta: { token: string; id: string };
    let quemResponde: { token: string; id: string };
    let outra: { token: string; id: string };

    const registar = async (sufixo: string) => {
        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: `${marca}${sufixo}@vicehub.test`,
                username: `${marca}${sufixo}`,
                password: 'Sup3rS3cret!Pass',
            },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return {
            token: resposta.json().accessToken as string,
            id: resposta.json().user.id as string,
        };
    };

    const abrirTopico = async () => {
        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/forum/topics',
            headers: auth(quemPergunta.token),
            payload: {
                title: `Como se divide o dinheiro de um assalto ${marca}?`,
                body: 'Somos cinco e o líder quer levar metade.',
            },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return resposta.json().id as string;
    };

    const responder = async (topicId: string, quem: { token: string }, texto: string) => {
        const resposta = await app.inject({
            method: 'POST',
            url: `/api/v1/forum/topics/${topicId}/replies`,
            headers: auth(quem.token),
            payload: { body: texto },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return resposta.json().id as string;
    };

    const aceitar = (replyId: string, quem: { token: string }) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/forum/replies/${replyId}/accept`,
            headers: auth(quem.token),
        });

    const desmarcar = (replyId: string, quem: { token: string }) =>
        app.inject({
            method: 'DELETE',
            url: `/api/v1/forum/replies/${replyId}/accept`,
            headers: auth(quem.token),
        });

    const verTopico = async (topicId: string) => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/forum/topics/${topicId}`,
        });

        expect(resposta.statusCode, resposta.body).toBe(200);

        return resposta.json() as {
            acceptedReplyId: string | null;
            askedById: string | null;
            replies: { id: string }[];
        };
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        quemPergunta = await registar('p');
        quemResponde = await registar('r');
        outra = await registar('o');
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('é marcada por quem perguntou', async () => {
        const topico = await abrirTopico();
        const resposta = await responder(topico, quemResponde, 'Divide por participação.');

        const marcou = await aceitar(resposta, quemPergunta);

        expect(marcou.statusCode, marcou.body).toBe(204);
        expect((await verTopico(topico)).acceptedReplyId).toBe(resposta);
    });

    /**
     * E por mais ninguém — nem por quem respondeu, nem por outra
     * pessoa qualquer. A resposta que serviu é um facto de quem tinha o
     * problema.
     */
    it.each([
        ['quem respondeu', () => quemResponde],
        ['uma pessoa de fora', () => outra],
    ])('e não por %s', async (_nome, quem) => {
        const topico = await abrirTopico();
        const resposta = await responder(topico, quemResponde, 'Divide por participação.');

        const tentou = await aceitar(resposta, quem());

        expect(tentou.statusCode).toBe(403);
        expect(tentou.json().code).toBe('NOT_THE_ASKER');
        expect((await verTopico(topico)).acceptedReplyId).toBeNull();
    });

    /**
     * O caso que dá razão a pôr o apontador no tópico: marcar outra
     * desmarca a primeira, e não há um instante com duas.
     */
    it('e marcar outra move a marca, sem passar por duas', async () => {
        const topico = await abrirTopico();
        const primeira = await responder(topico, quemResponde, 'Divide por igual.');
        const segunda = await responder(topico, outra, 'Não: divide por participação.');

        await aceitar(primeira, quemPergunta);
        await aceitar(segunda, quemPergunta);

        expect((await verTopico(topico)).acceptedReplyId).toBe(segunda);

        const quantas = await prisma.forumTopic.count({
            where: { id: topico, accepted_reply_id: { in: [primeira, segunda] } },
        });

        expect(quantas).toBe(1);
    });

    it('e pode ser desmarcada por quem a marcou', async () => {
        const topico = await abrirTopico();
        const resposta = await responder(topico, quemResponde, 'Divide por participação.');

        await aceitar(resposta, quemPergunta);
        const limpou = await desmarcar(resposta, quemPergunta);

        expect(limpou.statusCode, limpou.body).toBe(204);
        expect((await verTopico(topico)).acceptedReplyId).toBeNull();
    });

    /**
     * A regra que a base não garante: retirar a resposta aceite limpa a
     * marca. Sem isto, o tópico continuava a apontar para uma resposta
     * retirada e o ecrã punha uma marca de "resolvido" por cima de um
     * buraco.
     */
    it('e retirar a resposta aceite tira-lhe a marca', async () => {
        const topico = await abrirTopico();
        const resposta = await responder(topico, quemResponde, 'Divide por participação.');

        await aceitar(resposta, quemPergunta);

        const retirou = await app.inject({
            method: 'DELETE',
            url: `/api/v1/forum/replies/${resposta}`,
            headers: auth(quemResponde.token),
        });

        expect(retirou.statusCode, retirou.body).toBe(204);
        expect((await verTopico(topico)).acceptedReplyId).toBeNull();
    });

    /** E vem em primeiro lugar, que é a razão de isto existir. */
    it('e a aceite é a primeira da lista, esteja onde estiver', async () => {
        const topico = await abrirTopico();
        const primeira = await responder(topico, quemResponde, 'Uma ideia qualquer.');
        const segunda = await responder(topico, outra, 'Outra ideia qualquer.');
        const terceira = await responder(topico, quemResponde, 'Divide por participação.');

        expect((await verTopico(topico)).replies.map((r) => r.id)).toEqual([
            primeira,
            segunda,
            terceira,
        ]);

        await aceitar(terceira, quemPergunta);

        expect((await verTopico(topico)).replies.map((r) => r.id)).toEqual([
            terceira,
            primeira,
            segunda,
        ]);
    });

    /**
     * E quem respondeu fica a saber. É o que faz alguém responder outra
     * vez: uma resposta aceite sem aviso é um agradecimento que não
     * chega a ninguém.
     */
    it('e quem respondeu recebe um aviso', async () => {
        const topico = await abrirTopico();
        const resposta = await responder(topico, quemResponde, 'Divide por participação.');

        await aceitar(resposta, quemPergunta);

        const avisos = await app.inject({
            method: 'GET',
            url: '/api/v1/notifications',
            headers: auth(quemResponde.token),
        });

        const caixa = avisos.json() as {
            notifications: { kind: string; openId: string }[];
        };

        const aceite = caixa.notifications.filter(
            (aviso) => aviso.kind === 'forum_accepted',
        );

        expect(aceite.length).toBeGreaterThan(0);
        expect(aceite[0]?.openId).toBe(topico);
    });

    /**
     * Mas não a si próprio, e não duas vezes pela mesma coisa.
     *
     * Quem responde à sua própria pergunta não se avisa. E marcar a que
     * já está marcada não faz nada — sem isso, dois toques no mesmo
     * botão davam dois avisos pela mesma coisa.
     */
    it('e não avisa quem marcou a sua própria resposta', async () => {
        const topico = await abrirTopico();
        const resposta = await responder(topico, quemPergunta, 'Afinal descobri.');

        await aceitar(resposta, quemPergunta);
        await aceitar(resposta, quemPergunta);

        const quantos = await prisma.notification.count({
            where: { kind: 'forum_accepted', replyId: resposta },
        });

        expect(quantos).toBe(0);
    });

    it('e marcar duas vezes a mesma dá um aviso só', async () => {
        const topico = await abrirTopico();
        const resposta = await responder(topico, quemResponde, 'Divide por participação.');

        await aceitar(resposta, quemPergunta);
        await aceitar(resposta, quemPergunta);

        const quantos = await prisma.notification.count({
            where: { kind: 'forum_accepted', replyId: resposta },
        });

        expect(quantos).toBe(1);
    });

    /** Fechar um tópico não impede de dizer qual resposta serviu. */
    it('e um tópico fechado continua a poder ser marcado', async () => {
        const topico = await abrirTopico();
        const resposta = await responder(topico, quemResponde, 'Divide por participação.');

        await prisma.forumTopic.update({
            where: { id: topico },
            data: { locked_at: new Date() },
        });

        const marcou = await aceitar(resposta, quemPergunta);

        expect(marcou.statusCode, marcou.body).toBe(204);
    });

    /**
     * E a lista diz quais perguntas já têm resposta escolhida.
     *
     * Dois tópicos, um marcado e outro não, e comparam-se os dois: um
     * teste que só olhasse ao marcado passava com um `isAnswered` preso
     * a `true`, que é precisamente o defeito que faria a lista mentir.
     */
    it('e a lista de perguntas diz quais estão resolvidas', async () => {
        const resolvido = await abrirTopico();
        const resposta = await responder(
            resolvido,
            quemResponde,
            'Divide por participação.',
        );

        await aceitar(resposta, quemPergunta);

        const porResolver = await abrirTopico();
        await responder(porResolver, quemResponde, 'Não faço ideia, desculpa.');

        const lista = await app.inject({
            method: 'GET',
            url: `/api/v1/forum/topics?q=${encodeURIComponent(marca)}`,
        });

        const pagina = lista.json() as {
            topics: { id: string; isAnswered: boolean }[];
        };

        const olhar = (id: string) =>
            pagina.topics.find((um) => um.id === id)?.isAnswered;

        expect(olhar(resolvido)).toBe(true);
        expect(olhar(porResolver)).toBe(false);
    });
});
