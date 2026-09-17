import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';
import { tagAoAcaso } from '../helpers/crew-tags.js';

/**
 * A reputação, do evento até ao perfil público.
 *
 * A coluna `reputation` sempre existiu e sempre esteve a zero para toda
 * a gente: nada a somava. O que aqui se prova não é a aritmética — isso
 * o teste da regra já faz sem base de dados nenhuma. É que **o número
 * que aparece no perfil muda por causa do que aconteceu num evento**, e
 * que o mesmo evento não o muda duas vezes.
 *
 * Essa segunda parte não depende de o serviço estar bem escrito: a
 * transição para concluído é condicional e só um pedido a ganha, mas
 * isso dura enquanto ninguém mexer no serviço. A garantia que dura é o
 * índice, e um índice ou está certo ou deixa passar — não há maneira de
 * saber qual sem uma base a sério.
 */
describe('a reputação de quem aparece', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let lider: string;
    let liderId: string;
    let liderNome: string;
    let pontual: string;
    let pontualId: string;
    let pontualNome: string;
    let faltoso: string;
    let faltosoId: string;
    let faltosoNome: string;
    let crewId: string;

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
            username,
        };
    };

    const entrarNaCrew = async (token: string, userId: string) => {
        await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/join`,
            headers: auth(token),
        });

        await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/requests/${userId}/accept`,
            headers: auth(lider),
        });
    };

    /** Marca um evento e inscreve quem for indicado. */
    const eventoCom = async (inscritos: string[]): Promise<string> => {
        const evento = await app.inject({
            method: 'POST',
            url: `/api/v1/events/crews/${crewId}`,
            headers: auth(lider),
            payload: {
                name: `Assalto ${marca}-${Math.random().toString(36).slice(2, 7)}`,
                startsAt: new Date(Date.now() + 86_400_000).toISOString(),
            },
        });

        expect(evento.statusCode, evento.body).toBe(201);

        const eventId = evento.json().id as string;

        for (const token of inscritos) {
            const inscricao = await app.inject({
                method: 'POST',
                url: `/api/v1/events/crews/${crewId}/${eventId}/signup`,
                headers: auth(token),
            });

            expect(inscricao.statusCode, inscricao.body).toBe(204);
        }

        return eventId;
    };

    const confirmar = async (eventId: string, userId: string) => {
        const resposta = await app.inject({
            method: 'POST',
            url: `/api/v1/events/crews/${crewId}/${eventId}/participants/${userId}/confirm`,
            headers: auth(lider),
            payload: {},
        });

        expect(resposta.statusCode, resposta.body).toBe(204);
    };

    const marcarFalta = async (eventId: string, userId: string) => {
        const resposta = await app.inject({
            method: 'POST',
            url: `/api/v1/events/crews/${crewId}/${eventId}/participants/${userId}/no-show`,
            headers: auth(lider),
        });

        expect(resposta.statusCode, resposta.body).toBe(204);
    };

    const concluir = (eventId: string) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/events/crews/${crewId}/${eventId}/status`,
            headers: auth(lider),
            payload: { status: 'completed' },
        });

    /** A reputação como o mundo a vê: pelo perfil público. */
    const reputacaoDe = async (username: string): Promise<number> => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/users/${username}`,
        });

        expect(resposta.statusCode, resposta.body).toBe(200);

        return resposta.json().reputation as number;
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        const l = await register(`rep${marca}`);
        const p = await register(`rpp${marca}`);
        const f = await register(`rpf${marca}`);

        lider = l.token;
        liderId = l.id;
        liderNome = l.username;
        pontual = p.token;
        pontualId = p.id;
        pontualNome = p.username;
        faltoso = f.token;
        faltosoId = f.id;
        faltosoNome = f.username;

        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(lider),
            payload: { name: `Reputação ${marca}`, tag: tagAoAcaso() },
        });

        expect(crew.statusCode, crew.body).toBe(201);
        crewId = crew.json().id as string;

        await entrarNaCrew(pontual, pontualId);
        await entrarNaCrew(faltoso, faltosoId);
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('quem acaba de se registar não tem reputação nenhuma', async () => {
        expect(await reputacaoDe(pontualNome)).toBe(0);
    });

    /**
     * O caso inteiro, numa passagem: dois inscritos, um apareceu e o
     * outro não, e o número de cada um vai para lados diferentes a
     * partir do mesmo evento.
     */
    it('sobe a quem apareceu e desce a quem faltou', async () => {
        const antesPontual = await reputacaoDe(pontualNome);
        const antesFaltoso = await reputacaoDe(faltosoNome);

        const eventId = await eventoCom([lider, pontual, faltoso]);

        await confirmar(eventId, liderId);
        await confirmar(eventId, pontualId);
        await marcarFalta(eventId, faltosoId);

        expect((await concluir(eventId)).statusCode).toBe(200);

        expect(await reputacaoDe(pontualNome)).toBe(antesPontual + 1);
        expect(await reputacaoDe(faltosoNome)).toBe(antesFaltoso - 1);
    });

    /**
     * E desce abaixo de zero. Um chão faria a soma das linhas deixar de
     * ser o número, e apagaria a diferença entre quem nunca foi a nada e
     * quem falta a tudo a que se inscreve — que é precisamente a
     * diferença que isto existe para mostrar.
     */
    it('desce abaixo de zero a quem falta mais do que aparece', async () => {
        const eventId = await eventoCom([lider, pontual, faltoso]);

        await confirmar(eventId, liderId);
        await confirmar(eventId, pontualId);
        await marcarFalta(eventId, faltosoId);

        expect((await concluir(eventId)).statusCode).toBe(200);

        expect(await reputacaoDe(faltosoNome)).toBeLessThan(0);
    });

    /**
     * Ninguém se pronunciou sobre quem ficou inscrito e por confirmar.
     * Castigá-lo seria castigá-lo pelo silêncio de quem organiza.
     */
    it('não mexe em quem ficou por confirmar', async () => {
        const antes = await reputacaoDe(pontualNome);

        const eventId = await eventoCom([lider, pontual]);

        await confirmar(eventId, liderId);

        expect((await concluir(eventId)).statusCode).toBe(200);

        expect(await reputacaoDe(pontualNome)).toBe(antes);

        const linhas = await prisma.reputationAward.count({
            where: { eventId, userId: pontualId },
        });

        expect(linhas).toBe(0);
    });

    /**
     * Desistir não é faltar. Avisar que já não se vai é o comportamento
     * que se quer, e não pode custar o mesmo que desaparecer sem dizer
     * nada.
     */
    it('não castiga quem desistiu antes', async () => {
        const antes = await reputacaoDe(pontualNome);

        const eventId = await eventoCom([lider, pontual]);

        const desistencia = await app.inject({
            method: 'DELETE',
            url: `/api/v1/events/crews/${crewId}/${eventId}/signup`,
            headers: auth(pontual),
        });

        expect(desistencia.statusCode, desistencia.body).toBe(204);

        await confirmar(eventId, liderId);

        expect((await concluir(eventId)).statusCode).toBe(200);

        expect(await reputacaoDe(pontualNome)).toBe(antes);

        /**
         * E não fica com linha nenhuma.
         *
         * O número não mexer não chega: uma linha de valor zero deixava
         * o registo a dizer que este evento teve alguma coisa a dizer
         * sobre esta pessoa, quando não teve — e ocupava o lugar único
         * que este par pessoa/evento tem.
         */
        const linhas = await prisma.reputationAward.count({
            where: { eventId, userId: pontualId },
        });

        expect(linhas).toBe(0);
    });

    /**
     * Cada ponto tem um evento por trás.
     *
     * Sem a linha gravada, o número no perfil só se podia acreditar — e,
     * pior, voltava a ser contado à próxima, porque é a linha que impede
     * a repetição.
     */
    it('deixa uma linha a explicar cada mudança', async () => {
        const eventId = await eventoCom([lider, pontual, faltoso]);

        await confirmar(eventId, liderId);
        await confirmar(eventId, pontualId);
        await marcarFalta(eventId, faltosoId);

        expect((await concluir(eventId)).statusCode).toBe(200);

        const linhas = await prisma.reputationAward.findMany({
            where: { eventId },
            select: { userId: true, amount: true, reason: true },
        });

        expect(linhas).toHaveLength(3);

        const doPontual = linhas.find((linha) => linha.userId === pontualId);
        const doFaltoso = linhas.find((linha) => linha.userId === faltosoId);

        expect(doPontual).toMatchObject({
            amount: 1,
            reason: 'event_attended',
        });

        expect(doFaltoso).toMatchObject({
            amount: -1,
            reason: 'event_missed',
        });
    });

    /**
     * O mesmo evento não conta duas vezes.
     *
     * É a razão de a tabela existir. A segunda conclusão é recusada pelo
     * serviço, mas o que aqui se quer ver é o efeito: escrever as linhas
     * outra vez à força bate no índice, e a reputação não mexe.
     */
    it('o mesmo evento não conta duas vezes', async () => {
        const eventId = await eventoCom([lider, pontual]);

        await confirmar(eventId, liderId);
        await confirmar(eventId, pontualId);

        expect((await concluir(eventId)).statusCode).toBe(200);

        const depoisDaPrimeira = await reputacaoDe(pontualNome);

        /* A segunda tentativa de concluir é recusada: já está concluído. */
        expect((await concluir(eventId)).statusCode).toBe(409);

        expect(await reputacaoDe(pontualNome)).toBe(depoisDaPrimeira);

        /* E a escrita direta bate no índice, que é a garantia que dura. */
        await expect(
            prisma.reputationAward.create({
                data: {
                    userId: pontualId,
                    eventId,
                    amount: 1,
                    reason: 'event_attended',
                },
            }),
        ).rejects.toThrow();

        expect(await reputacaoDe(pontualNome)).toBe(depoisDaPrimeira);
    });
});
