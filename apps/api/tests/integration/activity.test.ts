import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * O feed de atividade, contra PostgreSQL a sério.
 *
 * O feed é uma vista de factos que já existem, e a promessa que ele faz
 * é a que interessa provar: **não mostra nada de novo**. Cada linha é
 * uma coisa que já se podia ver navegando — e, sobretudo, nada das
 * crews a que não pertenço aparece lá.
 */
describe('feed de atividade', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let eu: { token: string; id: string };
    let colega: { token: string; id: string };
    let amigo: { token: string; id: string };
    let estranho: { token: string; id: string };

    let minhaCrew: string;
    let crewAlheia: string;

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
                name: `Feed ${marca}${sufixo}`,
                tag: `F${sufixo}${marca.slice(-4)}`,
            },
        });

        expect(response.statusCode, response.body).toBe(201);

        return response.json().id as string;
    };

    const entrar = async (token: string, quem: string, crewId: string, dono: string) => {
        await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/join`,
            headers: auth(token),
        });

        const aceite = await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/requests/${quem}/accept`,
            headers: auth(dono),
        });

        expect(aceite.statusCode, aceite.body).toBe(204);
    };

    /** Um evento concluído com duas presenças, que dá xp à crew. */
    const eventoConcluido = async (
        crewId: string,
        dono: string,
        quem: { id: string; token: string }[],
    ) => {
        const evento = await app.inject({
            method: 'POST',
            url: `/api/v1/events/crews/${crewId}`,
            headers: auth(dono),
            payload: {
                name: `Assalto ${marca}-${Math.random().toString(36).slice(2, 7)}`,
                startsAt: new Date(Date.now() + 86_400_000).toISOString(),
            },
        });

        expect(evento.statusCode, evento.body).toBe(201);

        const eventId = evento.json().id as string;

        for (const pessoa of quem) {
            await app.inject({
                method: 'POST',
                url: `/api/v1/events/crews/${crewId}/${eventId}/signup`,
                headers: auth(pessoa.token),
            });

            await app.inject({
                method: 'POST',
                url: `/api/v1/events/crews/${crewId}/${eventId}/participants/${pessoa.id}/confirm`,
                headers: auth(dono),
                payload: {},
            });
        }

        await app.inject({
            method: 'POST',
            url: `/api/v1/events/crews/${crewId}/${eventId}/status`,
            headers: auth(dono),
            payload: { status: 'completed' },
        });

        return eventId;
    };

    const feedDe = async (token: string) => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/activity',
            headers: auth(token),
        });

        expect(response.statusCode, response.body).toBe(200);

        return response.json() as {
            kind: string;
            id: string;
            at: string;
            crew: { id: string; name: string };
            person?: { id: string; username: string };
            event?: { id: string; name: string } | null;
            amount?: number;
        }[];
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        eu = await register(`fde${marca}`);
        colega = await register(`fdc${marca}`);
        amigo = await register(`fda${marca}`);
        estranho = await register(`fdx${marca}`);

        minhaCrew = await criarCrew(eu.token, 'a');
        crewAlheia = await criarCrew(estranho.token, 'b');

        await entrar(colega.token, colega.id, minhaCrew, eu.token);

        /* Somos amigos: o que o amigo fizer entra no meu feed. */
        await app.inject({
            method: 'POST',
            url: `/api/v1/friends/${amigo.id}`,
            headers: auth(eu.token),
        });

        await app.inject({
            method: 'POST',
            url: `/api/v1/friends/${eu.id}/accept`,
            headers: auth(amigo.token),
        });

        await eventoConcluido(minhaCrew, eu.token, [eu, colega]);

        /*
          E na crew alheia acontece exatamente o mesmo — entrada e
          evento concluído — sem eu ter nada a ver com isso. É o que dá
          ao caso seguinte alguma coisa que ele possa apanhar: sem um
          evento aqui, tirar o filtro do feed não mudava nada e o teste
          passava a dizer que sim a tudo.
        */
        await entrar(colega.token, colega.id, crewAlheia, estranho.token);
        await eventoConcluido(crewAlheia, estranho.token, [estranho, colega]);
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('mostra o evento concluído da minha crew', async () => {
        const feed = await feedDe(eu.token);

        const evento = feed.find(
            (item) => item.kind === 'crew_event' && item.crew.id === minhaCrew,
        );

        expect(evento).toBeDefined();
        expect(evento?.event).not.toBeNull();
        expect(evento?.amount).toBeGreaterThan(0);
    });

    it('mostra quem entrou na minha crew', async () => {
        const feed = await feedDe(eu.token);

        const entrada = feed.find(
            (item) =>
                item.kind === 'crew_joined'
                && item.crew.id === minhaCrew
                && item.person?.id === colega.id,
        );

        expect(entrada).toBeDefined();
    });

    /**
     * A promessa do feed: nada de novo. O que se passa numa crew a que
     * não pertenço não me chega por aqui — nem sequer o nome do evento.
     */
    it('não mostra nada das crews a que não pertenço', async () => {
        /* A crew alheia teve mesmo atividade: entrada e evento concluído. */
        const doEstranho = await feedDe(estranho.token);

        expect(
            doEstranho.filter((item) => item.crew.id === crewAlheia).length,
        ).toBeGreaterThan(0);

        const meu = await feedDe(eu.token);

        expect(meu.map((item) => item.crew.id)).not.toContain(crewAlheia);
    });

    it('mostra as crews em que um amigo entrou', async () => {
        const outraCrew = await criarCrew(estranho.token, 'c');

        await entrar(amigo.token, amigo.id, outraCrew, estranho.token);

        const feed = await feedDe(eu.token);

        const entrada = feed.find(
            (item) =>
                item.kind === 'friend_joined_crew'
                && item.person?.id === amigo.id
                && item.crew.id === outraCrew,
        );

        expect(entrada).toBeDefined();
    });

    /** Quem não é meu amigo não entra no feed por entrar numa crew. */
    it('não mostra as crews em que entrou quem não é meu amigo', async () => {
        const feed = await feedDe(eu.token);

        const doEstranho = feed.filter(
            (item) =>
                item.kind === 'friend_joined_crew'
                && item.person?.id === estranho.id,
        );

        expect(doEstranho).toHaveLength(0);
    });

    /**
     * Um amigo que entra numa crew minha chega por dois caminhos. É a
     * mesma coisa, e por isso aparece uma vez só.
     */
    it('não repete o que chega por dois caminhos', async () => {
        await entrar(amigo.token, amigo.id, minhaCrew, eu.token);

        const feed = await feedDe(eu.token);

        const entradas = feed.filter(
            (item) => item.person?.id === amigo.id && item.crew.id === minhaCrew,
        );

        expect(entradas).toHaveLength(1);
        expect(feed.map((item) => item.id)).toHaveLength(
            new Set(feed.map((item) => item.id)).size,
        );
    });

    it('vem do mais recente para o mais antigo', async () => {
        const datas = (await feedDe(eu.token)).map((item) => Date.parse(item.at));

        expect(datas).toEqual([...datas].sort((a, b) => b - a));
    });

    it('quem não tem nada vê uma lista vazia, e não um erro', async () => {
        const sozinho = await register(`fdz${marca}`);

        expect(await feedDe(sozinho.token)).toEqual([]);
    });

    it('exige sessão', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/activity',
        });

        expect(response.statusCode).toBe(401);
    });
});
