import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * A montra de eventos, contra PostgreSQL a sério.
 *
 * A propriedade central é uma fronteira, e uma fronteira só se verifica
 * a atravessá-la: **nada aparece na montra por omissão**. O calendário
 * de uma comunidade continua a exigir `event:read`; o que a montra
 * mostra é apenas o que alguém, dentro dela, decidiu mostrar.
 *
 * Todos os pedidos à montra vão **sem sessão nenhuma**, e não com a de
 * um estranho: é essa a pessoa para quem a montra existe.
 */
describe('a montra pública de eventos', () => {
    let app: FastifyInstance;

    /**
     * Todos os eventos deste ficheiro começam por aqui.
     *
     * Serve para os limpar: um evento público sem hora de fim fica na
     * montra durante horas, e sem limpeza cada corrida da suite deixava
     * mais dez lá dentro até encherem o limite da própria montra.
     */
    const PREFIXO = 'montra-';

    const marca = `pub${Date.now()}`;

    /** Apaga o que este ficheiro deixou, agora e em corridas passadas. */
    const limpar = () =>
        prisma.event.deleteMany({ where: { name: { startsWith: PREFIXO } } });

    let lider: string;
    let estranho: string;
    let crewId: string;

    /**
     * Um evento público que está sempre lá, e serve de controlo.
     *
     * A montra tem um limite, e a base de dados de testes acumula
     * eventos de todas as corridas anteriores. Sem controlo, um
     * "não aparece" passava sozinho pela pior das razões: o evento ter
     * ficado de fora do limite. Cada asserção confirma, no mesmo
     * pedido, que este continua visível — se ele desaparecer, o teste
     * cai em vez de dar por bom o que não verificou.
     */
    let controloId: string;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

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

    const criarEvento = async (
        payload: Record<string, unknown>,
        dono = crewId,
    ): Promise<string> => {
        const response = await app.inject({
            method: 'POST',
            url: `/api/v1/events/crews/${dono}`,
            headers: auth(lider),
            payload: {
                name: `${PREFIXO}assalto-${marca}`,
                /**
                 * Daqui a dois minutos, e não daqui a um dia: a montra
                 * ordena pelo começo e tem limite, e os eventos das
                 * outras suites marcam-se para amanhã. Assim os deste
                 * ficheiro vêm sempre à frente deles.
                 */
                startsAt: new Date(Date.now() + 120_000).toISOString(),
                ...payload,
            },
        });

        expect(response.statusCode, response.body).toBe(201);

        return response.json().id as string;
    };

    /** A montra, tal como um visitante sem conta a vê. */
    const montra = async (): Promise<
        { id: string; name: string; owner: { name: string } }[]
    > => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/events/public?limit=50',
        });

        expect(response.statusCode, response.body).toBe(200);

        return response.json();
    };

    /**
     * Se um evento está na montra — confirmando, no mesmo pedido, que a
     * montra ainda mostra o controlo.
     */
    const estaNaMontra = async (eventId: string): Promise<boolean> => {
        const lista = await montra();

        expect(
            lista.some((evento) => evento.id === controloId),
            'o controlo saiu da montra: a resposta abaixo não prova nada',
        ).toBe(true);

        return lista.some((evento) => evento.id === eventId);
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        await limpar();

        lider = await register(`${marca}l`);
        estranho = await register(`${marca}e`);

        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(lider),
            payload: { name: `Montra ${marca}`, tag: `M${marca.slice(-5)}` },
        });

        expect(crew.statusCode, crew.body).toBe(201);
        crewId = crew.json().id as string;

        controloId = await criarEvento({
            name: `${PREFIXO}controlo-${marca}`,
            isPublic: true,
        });
    });

    afterAll(async () => {
        await limpar();
        await app.close();
    });

    /**
     * O valor por omissão é a decisão toda.
     *
     * Se marcar um evento o pusesse na montra, cada comunidade que já
     * usa a plataforma teria o calendário publicado por uma migração
     * ter corrido. É a única maneira de errar isto que não tem volta.
     */
    it('não mostra um evento que ninguém marcou como público', async () => {
        const eventId = await criarEvento({});

        expect(await estaNaMontra(eventId)).toBe(false);
    });

    /**
     * O controlo prova que o "não aparece" acima é uma decisão da
     * montra, e não o efeito de a lista estar cheia.
     */
    it('mostra o controlo, que foi marcado como público', async () => {
        expect(await estaNaMontra(controloId)).toBe(true);
    });

    it('mostra a quem nem sessão tem o que a comunidade abriu', async () => {
        const eventId = await criarEvento({
            name: `${PREFIXO}corrida-${marca}`,
            isPublic: true,
        });

        expect(await estaNaMontra(eventId)).toBe(true);

        const evento = (await montra()).find((linha) => linha.id === eventId);

        expect(evento).toBeDefined();
        expect(evento?.name).toBe(`${PREFIXO}corrida-${marca}`);
        expect(evento?.owner.name).toBe(`Montra ${marca}`);
    });

    /**
     * Um evento público não torna público quem vai a ele.
     *
     * A montra leva o que serve para decidir se vale a pena ir ver — o
     * que é, quando é, e de quem. Quem se inscreveu continua a ser
     * assunto de dentro.
     */
    it('não leva participantes nem lotação', async () => {
        const eventId = await criarEvento({
            isPublic: true,
            capacity: 8,
            description: 'Encontramo-nos no parque',
        });

        expect(await estaNaMontra(eventId)).toBe(true);

        const evento = (await montra()).find((linha) => linha.id === eventId);

        expect(evento).toBeDefined();
        expect(Object.keys(evento ?? {}).sort()).toEqual([
            'endsAt',
            'id',
            'name',
            'owner',
            'startsAt',
            'status',
        ]);
    });

    /**
     * A montra existir não abre o calendário.
     *
     * Este é o teste que impede a fronteira de escorregar: alguém de
     * fora continua a levar 403 no calendário da crew, mesmo havendo lá
     * dentro um evento que ela própria pôs à porta.
     */
    it('não abre o calendário da comunidade a quem não pertence', async () => {
        await criarEvento({ isPublic: true });

        const calendario = await app.inject({
            method: 'GET',
            url: `/api/v1/events/crews/${crewId}`,
            headers: auth(estranho),
        });

        expect(calendario.statusCode).toBe(403);

        const semSessao = await app.inject({
            method: 'GET',
            url: `/api/v1/events/crews/${crewId}`,
        });

        expect(semSessao.statusCode).toBe(401);
    });

    it('deixa de mostrar o que a comunidade voltou a fechar', async () => {
        const eventId = await criarEvento({ isPublic: true });

        expect(await estaNaMontra(eventId)).toBe(true);

        const fechado = await app.inject({
            method: 'PATCH',
            url: `/api/v1/events/crews/${crewId}/${eventId}`,
            headers: auth(lider),
            payload: { isPublic: false },
        });

        expect(fechado.statusCode, fechado.body).toBe(200);
        expect(await estaNaMontra(eventId)).toBe(false);
    });

    /**
     * Um PATCH que não fala nisto não abre nem fecha nada. Mudar o nome
     * de um evento não é dizer nada sobre quem o pode ver.
     */
    it('mudar só o nome não mexe no que é público', async () => {
        const eventId = await criarEvento({ isPublic: true });

        const resposta = await app.inject({
            method: 'PATCH',
            url: `/api/v1/events/crews/${crewId}/${eventId}`,
            headers: auth(lider),
            payload: { name: `${PREFIXO}outro-nome-${marca}` },
        });

        expect(resposta.statusCode, resposta.body).toBe(200);
        expect(resposta.json().isPublic).toBe(true);
        expect(await estaNaMontra(eventId)).toBe(true);
    });

    it('deixa de mostrar um evento cancelado', async () => {
        const eventId = await criarEvento({ isPublic: true });

        const cancelado = await app.inject({
            method: 'POST',
            url: `/api/v1/events/crews/${crewId}/${eventId}/status`,
            headers: auth(lider),
            payload: { status: 'canceled' },
        });

        expect(cancelado.statusCode, cancelado.body).toBe(200);
        expect(await estaNaMontra(eventId)).toBe(false);
    });

    /**
     * Sem uma janela, um evento que ninguém se lembrou de fechar ficava
     * na montra para sempre — e a página de entrada anunciava como "a
     * decorrer" uma noite que acabou há meses.
     */
    it('deixa cair o que já começou há muito e não tem fim escrito', async () => {
        const eventId = await criarEvento({ isPublic: true });

        await prisma.event.update({
            where: { id: eventId },
            data: {
                starts_at: new Date(Date.now() - 48 * 3_600_000),
                ends_at: null,
            },
        });

        expect(await estaNaMontra(eventId)).toBe(false);
    });

    /**
     * Já a decorrer é precisamente o que a montra existe para mostrar:
     * fica, apesar de a hora de começar já ter passado.
     */
    it('mantém o que começou há pouco e ainda não acabou', async () => {
        const eventId = await criarEvento({ isPublic: true });

        await prisma.event.update({
            where: { id: eventId },
            data: {
                starts_at: new Date(Date.now() - 3_600_000),
                ends_at: new Date(Date.now() + 3_600_000),
            },
        });

        expect(await estaNaMontra(eventId)).toBe(true);
    });

    /**
     * Apagar uma crew apaga em suave os eventos dela, na mesma escrita.
     * É esse `is_deleted` que os tira da montra — e é o que este teste
     * verifica de ponta a ponta, porque as duas metades vivem em
     * módulos diferentes e nada as obriga a continuar de acordo.
     *
     * Sem isto, a montra anunciava encontros de crews que já não
     * existem, com um link para uma página que dá erro.
     */
    it('deixa de mostrar os eventos de uma crew apagada', async () => {
        const outroLider = await register(`${marca}o`);

        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(outroLider),
            payload: { name: `Efemera ${marca}`, tag: `F${marca.slice(-5)}` },
        });

        expect(crew.statusCode, crew.body).toBe(201);

        const outraCrewId = crew.json().id as string;

        const evento = await app.inject({
            method: 'POST',
            url: `/api/v1/events/crews/${outraCrewId}`,
            headers: auth(outroLider),
            payload: {
                name: `${PREFIXO}despedida-${marca}`,
                startsAt: new Date(Date.now() + 120_000).toISOString(),
                isPublic: true,
            },
        });

        expect(evento.statusCode, evento.body).toBe(201);

        const eventId = evento.json().id as string;

        expect(await estaNaMontra(eventId)).toBe(true);

        const apagada = await app.inject({
            method: 'DELETE',
            url: `/api/v1/crews/${outraCrewId}`,
            headers: auth(outroLider),
        });

        expect(apagada.statusCode, apagada.body).toBe(204);
        expect(await estaNaMontra(eventId)).toBe(false);
    });
});
