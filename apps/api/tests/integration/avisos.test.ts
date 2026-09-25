import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * Os avisos, contra PostgreSQL a sério.
 *
 * A razão de existirem: a plataforma tem sítios onde outra pessoa fala
 * contigo e nenhum deles tinha como te dizer que falou. O que aqui se
 * prova é que o aviso chega **a quem é para chegar** — e, sobretudo,
 * que não chega a mais ninguém.
 *
 * E que ninguém se avisa a si próprio: uma caixa cheia dos próprios
 * actos é uma caixa que se deixa de abrir.
 */
describe('os avisos', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let ana: { token: string; id: string; nome: string };
    let bruno: { token: string; id: string; nome: string };
    let carla: { token: string; id: string; nome: string };

    let serverId: string;

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

    const caixa = async (quem: { token: string }) => {
        const resposta = await app.inject({
            method: 'GET',
            url: '/api/v1/notifications',
            headers: auth(quem.token),
        });

        expect(resposta.statusCode, resposta.body).toBe(200);

        return resposta.json() as {
            notifications: {
                id: string;
                kind: string;
                openId: string;
                about: string | null;
                excerpt: string | null;
                isRead: boolean;
                actor: { username: string } | null;
            }[];
            unread: number;
            total: number;
        };
    };

    const porLer = async (quem: { token: string }) => {
        const resposta = await app.inject({
            method: 'GET',
            url: '/api/v1/notifications/unread',
            headers: auth(quem.token),
        });

        expect(resposta.statusCode, resposta.body).toBe(200);

        return resposta.json().unread as number;
    };

    const anunciar = async (titulo: string) => {
        const resposta = await app.inject({
            method: 'POST',
            url: `/api/v1/market/servers/${serverId}/listings`,
            headers: auth(ana.token),
            payload: {
                category: 'vehicle',
                title: `${titulo} ${marca}`,
                body: 'Entrego no parque do porto.',
                price: '250000',
            },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return resposta.json().id as string;
    };

    const conversar = async (quem: { token: string }, listingId: string) => {
        const conversa = await app.inject({
            method: 'POST',
            url: `/api/v1/market/listings/${listingId}/conversations`,
            headers: auth(quem.token),
        });

        expect(conversa.statusCode, conversa.body).toBe(201);

        return conversa.json().id as string;
    };

    const escrever = (
        quem: { token: string },
        conversationId: string,
        body = 'Ainda tens isto?',
    ) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/market/conversations/${conversationId}/messages`,
            headers: auth(quem.token),
            payload: { body },
        });

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        ana = await registar(`na${marca}`);
        bruno = await registar(`nb${marca}`);
        carla = await registar(`nc${marca}`);

        const servidor = await app.inject({
            method: 'POST',
            url: '/api/v1/servers',
            headers: auth(ana.token),
            payload: { name: `Servidor dos avisos ${marca}` },
        });

        expect(servidor.statusCode, servidor.body).toBe(201);
        serverId = servidor.json().id as string;
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('avisa a outra pessoa de uma mensagem', async () => {
        const listingId = await anunciar('Com mensagem');
        const conversationId = await conversar(bruno, listingId);

        await escrever(bruno, conversationId, 'A que horas entregas?');

        const daAna = await caixa(ana);
        const aviso = daAna.notifications[0];

        expect(aviso?.kind).toBe('market_message');
        expect(aviso?.actor?.username).toBe(bruno.nome);
        expect(aviso?.openId).toBe(conversationId);
        expect(aviso?.excerpt).toContain('A que horas');
        expect(aviso?.isRead).toBe(false);
    });

    /**
     * E do outro lado também.
     *
     * A conversa tem dois lados e quem responde é, quase sempre, quem
     * vende: um aviso que só funcionasse na direcção de quem compra
     * deixava sem saber precisamente a pessoa que está à espera de
     * resposta.
     */
    it('e avisa quem comprou, quando é quem vende a responder', async () => {
        const listingId = await anunciar('Com resposta de quem vende');
        const conversationId = await conversar(bruno, listingId);

        await escrever(bruno, conversationId, 'Ainda tens isto?');
        await escrever(ana, conversationId, 'Tenho, sim. Entrego hoje.');

        const doBruno = await caixa(bruno);
        const aviso = doBruno.notifications[0];

        expect(aviso?.kind).toBe('market_message');
        expect(aviso?.actor?.username).toBe(ana.nome);
        expect(aviso?.openId).toBe(conversationId);
        expect(aviso?.excerpt).toContain('Entrego hoje');
    });

    /**
     * A caixa de uma pessoa é dela. Quem não está na conversa não
     * recebe aviso nenhum dela — nem sequer de que ela existe.
     */
    it('e não avisa quem não tem nada a ver com aquilo', async () => {
        const antes = await porLer(carla);

        const listingId = await anunciar('Sem a carla');
        const conversationId = await conversar(bruno, listingId);

        await escrever(bruno, conversationId);

        expect(await porLer(carla)).toBe(antes);
    });

    it('não avisa quem escreveu', async () => {
        const listingId = await anunciar('Sem eco');
        const conversationId = await conversar(bruno, listingId);

        const antes = await porLer(bruno);

        await escrever(bruno, conversationId);

        expect(await porLer(bruno)).toBe(antes);
    });

    it('avisa quem perguntou no fórum', async () => {
        const topico = await app.inject({
            method: 'POST',
            url: '/api/v1/forum/topics',
            headers: auth(ana.token),
            payload: {
                title: `Uma pergunta com resposta ${marca}`,
                body: 'O corpo da pergunta, com tamanho suficiente.',
            },
        });

        expect(topico.statusCode, topico.body).toBe(201);

        const topicId = topico.json().id as string;

        const resposta = await app.inject({
            method: 'POST',
            url: `/api/v1/forum/topics/${topicId}/replies`,
            headers: auth(bruno.token),
            payload: { body: 'Divides por participação, e fica feito.' },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        const daAna = await caixa(ana);
        const aviso = daAna.notifications[0];

        expect(aviso?.kind).toBe('forum_reply');
        expect(aviso?.openId).toBe(topicId);
        expect(aviso?.about).toContain('Uma pergunta com resposta');
    });

    it('não avisa quem responde à sua própria pergunta', async () => {
        const topico = await app.inject({
            method: 'POST',
            url: '/api/v1/forum/topics',
            headers: auth(ana.token),
            payload: {
                title: `Respondo-me a mim ${marca}`,
                body: 'O corpo da pergunta, com tamanho suficiente.',
            },
        });

        const topicId = topico.json().id as string;

        const antes = await porLer(ana);

        await app.inject({
            method: 'POST',
            url: `/api/v1/forum/topics/${topicId}/replies`,
            headers: auth(ana.token),
            payload: { body: 'Afinal já descobri como se faz.' },
        });

        expect(await porLer(ana)).toBe(antes);
    });

    describe('as avaliações', () => {
        const vendaAvaliada = async (titulo: string) => {
            const listingId = await anunciar(titulo);
            const conversationId = await conversar(bruno, listingId);

            await escrever(bruno, conversationId, 'Fico com isso.');

            await app.inject({
                method: 'POST',
                url: `/api/v1/market/listings/${listingId}/close`,
                headers: auth(ana.token),
                payload: { outcome: 'sold' },
            });

            const avaliacao = await app.inject({
                method: 'POST',
                url: `/api/v1/market/listings/${listingId}/reviews`,
                headers: auth(bruno.token),
                payload: { rating: 4, body: 'Entregou à hora combinada.' },
            });

            expect(avaliacao.statusCode, avaliacao.body).toBe(201);

            return avaliacao.json().id as string;
        };

        it('avisam quem foi avaliado', async () => {
            await vendaAvaliada('Avaliada');

            const daAna = await caixa(ana);
            const aviso = daAna.notifications[0];

            expect(aviso?.kind).toBe('market_review');
            expect(aviso?.actor?.username).toBe(bruno.nome);
            /** Abre-se no perfil de quem a recebeu: é lá que ela vive. */
            expect(aviso?.openId).toBe(ana.nome);
            expect(aviso?.excerpt).toContain('à hora combinada');
        });

        it('e a resposta avisa quem avaliou', async () => {
            const reviewId = await vendaAvaliada('Com resposta');

            const resposta = await app.inject({
                method: 'POST',
                url: `/api/v1/market/reviews/${reviewId}/reply`,
                headers: auth(ana.token),
                payload: { body: 'Atrasei-me dez minutos, tens razão.' },
            });

            expect(resposta.statusCode, resposta.body).toBe(200);

            const doBruno = await caixa(bruno);
            const aviso = doBruno.notifications[0];

            expect(aviso?.kind).toBe('market_review_reply');
            expect(aviso?.excerpt).toContain('dez minutos');
        });
    });

    describe('dar por lido', () => {
        it('dá um por lido, e só esse', async () => {
            const listingId = await anunciar('Para ler um');
            const conversationId = await conversar(bruno, listingId);

            await escrever(bruno, conversationId, 'Primeira.');
            await escrever(bruno, conversationId, 'Segunda.');

            const antes = await porLer(ana);

            expect(antes).toBeGreaterThanOrEqual(2);

            const daAna = await caixa(ana);
            const umId = daAna.notifications[0]?.id as string;

            const marcado = await app.inject({
                method: 'POST',
                url: `/api/v1/notifications/${umId}/read`,
                headers: auth(ana.token),
            });

            expect(marcado.statusCode, marcado.body).toBe(204);
            expect(await porLer(ana)).toBe(antes - 1);
        });

        /**
         * A condição do dono vai na escrita, e não numa leitura antes:
         * assim não há caminho em que o aviso de outra pessoa mude de
         * estado. A resposta é a mesma — não se diz a um estranho que
         * aquele aviso existe.
         */
        it('não deixa outra pessoa dar por lido o que não é dela', async () => {
            const listingId = await anunciar('De outra pessoa');
            const conversationId = await conversar(bruno, listingId);

            await escrever(bruno, conversationId);

            const daAna = await caixa(ana);
            const umId = daAna.notifications[0]?.id as string;

            const antes = await porLer(ana);

            const marcado = await app.inject({
                method: 'POST',
                url: `/api/v1/notifications/${umId}/read`,
                headers: auth(carla.token),
            });

            expect(marcado.statusCode).toBe(204);
            /** A resposta é a mesma, e o estado não mudou. */
            expect(await porLer(ana)).toBe(antes);
        });

        it('dá todos por lidos de uma vez', async () => {
            const listingId = await anunciar('Para ler tudo');
            const conversationId = await conversar(bruno, listingId);

            await escrever(bruno, conversationId);

            expect(await porLer(ana)).toBeGreaterThan(0);

            const marcados = await app.inject({
                method: 'POST',
                url: '/api/v1/notifications/read',
                headers: auth(ana.token),
            });

            expect(marcados.statusCode, marcados.body).toBe(204);
            expect(await porLer(ana)).toBe(0);
        });
    });

    it('não deixa ver a caixa sem sessão', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: '/api/v1/notifications',
        });

        expect(resposta.statusCode).toBe(401);
    });
});
