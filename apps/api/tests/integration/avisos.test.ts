import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { AVISOS_POR_PAGINA, prisma } from '@vicehub/database';
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

    /**
     * **A caixa é minha, e só minha.**
     *
     * É a propriedade mais importante desta rota e não tinha teste: um
     * mutante que apagasse o dono da condição — e passasse a devolver
     * os avisos de toda a gente — passava por esta suite inteira sem
     * uma queixa. O que se prova aqui não é que a minha caixa tem o que
     * devia: é que **não tem o que é de outra pessoa**.
     */
    it('não mostra a ninguém os avisos de outra pessoa', async () => {
        const listingId = await anunciar('Só para a ana');
        const conversationId = await conversar(bruno, listingId);

        await escrever(bruno, conversationId, 'Isto é só entre nós os dois.');

        const daAna = await caixa(ana);
        const daCarla = await caixa(carla);

        /* O aviso existe, e está na caixa certa. */
        expect(daAna.notifications.some((a) => a.openId === conversationId)).toBe(
            true,
        );

        /* E não está em mais nenhuma. */
        expect(
            daCarla.notifications.some((a) => a.openId === conversationId),
        ).toBe(false);

        expect(
            daCarla.notifications.every((a) => a.actor?.username !== bruno.nome)
            || daCarla.total === 0,
        ).toBe(true);
    });

    /**
     * E cada aviso aponta para o seu, quando há mais do que um da
     * mesma espécie.
     *
     * A página lê os alvos em lote e cruza-os por identificador. Com um
     * aviso só, um cruzamento trocado não se nota — e passaria a
     * mostrar, em cada linha, o excerto da conversa de outra.
     */
    it('e com duas mensagens, cada aviso leva a sua', async () => {
        const primeiro = await anunciar('Duas conversas, uma');
        const segundo = await anunciar('Duas conversas, duas');

        const conversaA = await conversar(bruno, primeiro);
        const conversaB = await conversar(carla, segundo);

        await escrever(bruno, conversaA, 'Pergunta sobre o primeiro carro.');
        await escrever(carla, conversaB, 'Pergunta sobre o segundo carro.');

        const daAna = await caixa(ana);

        const deA = daAna.notifications.find((a) => a.openId === conversaA);
        const deB = daAna.notifications.find((a) => a.openId === conversaB);

        expect(deA?.excerpt).toContain('primeiro carro');
        expect(deB?.excerpt).toContain('segundo carro');
        expect(deA?.actor?.username).toBe(bruno.nome);
        expect(deB?.actor?.username).toBe(carla.nome);
    });

    /**
     * E a caixa vem por páginas.
     *
     * Trinta por página, como está escrito no `AVISOS_POR_PAGINA`. Sem
     * limite, quem tenha meses de avisos recebia-os todos num pedido; e
     * uma segunda página que voltasse ao princípio era uma caixa onde
     * não se chega ao fundo.
     */
    it('e vem por páginas, com a segunda a continuar a primeira', async () => {
        const listingId = await anunciar('Muitas mensagens');
        const conversationId = await conversar(bruno, listingId);

        for (let i = 0; i < AVISOS_POR_PAGINA + 3; i += 1) {
            await escrever(bruno, conversationId, `Mensagem número ${i}.`);
        }

        const primeira = await caixa(ana);

        expect(primeira.notifications).toHaveLength(AVISOS_POR_PAGINA);

        const resposta = await app.inject({
            method: 'GET',
            url: '/api/v1/notifications?page=2',
            headers: auth(ana.token),
        });

        expect(resposta.statusCode, resposta.body).toBe(200);

        const segunda = resposta.json() as Awaited<ReturnType<typeof caixa>>;

        expect(segunda.notifications.length).toBeGreaterThan(0);

        /* E não repete a primeira. */
        const idsDaPrimeira = new Set(primeira.notifications.map((a) => a.id));

        expect(
            segunda.notifications.some((a) => idsDaPrimeira.has(a.id)),
        ).toBe(false);
    });

    it('não deixa ver a caixa sem sessão', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: '/api/v1/notifications',
        });

        expect(resposta.statusCode).toBe(401);
    });
});
