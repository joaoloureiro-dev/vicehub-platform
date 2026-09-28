import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * As categorias do fórum, contra PostgreSQL a sério.
 *
 * Aqui não há duplo que sirva. O que está em causa é o tipo
 * `ForumCategory` da base a recusar o que não conhece, a omissão da
 * coluna a valer para quem não escolhe, e — o caso que um duplo nunca
 * apanha — a **contagem** a levar o mesmo filtro que a lista: uma
 * categoria com três tópicos que diga «página 1 de 9» manda quem
 * carrega na 2 para uma lista vazia sem perceber porquê. Foi o erro que
 * a procura já fez, e a categoria é o mesmo filtro noutro campo.
 */
describe('as categorias do fórum', () => {
    let app: FastifyInstance;

    const marca = `ct${Date.now().toString().slice(-7)}`;
    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let token: string;

    const abrir = async (titulo: string, categoria?: string) => {
        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/forum/topics',
            headers: auth(token),
            payload: {
                title: titulo,
                body: `Escrito pela corrida ${marca}, e não interessa a mais ninguém.`,
                ...(categoria === undefined ? {} : { category: categoria }),
            },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return resposta.json().id as string;
    };

    const listar = async (query: string) => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/forum/topics${query}`,
        });

        expect(resposta.statusCode, resposta.body).toBe(200);

        return resposta.json() as {
            topics: { id: string; title: string; category: string }[];
            total: number;
            pages: number;
        };
    };

    /** Só o que esta corrida escreveu: a base traz tópicos de outras. */
    const meus = (
        pagina: { topics: { id: string; category: string }[] },
        ids: string[],
    ) => pagina.topics.filter((t) => ids.includes(t.id));

    let daGeral: string;
    let dasCrews: string;
    let dosServidores: string;
    let todos: string[];

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: `${marca}@vicehub.test`,
                username: marca,
                password: 'Sup3rS3cret!Pass',
            },
        });

        token = resposta.json().accessToken as string;

        daGeral = await abrir(`Boas a toda a gente ${marca}`);
        dasCrews = await abrir(`A crew procura gente ${marca}`, 'crews');
        dosServidores = await abrir(`O servidor caiu outra vez ${marca}`, 'servers');

        todos = [daGeral, dasCrews, dosServidores];
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    /**
     * Quem não escolhe cai na conversa geral. É a omissão da coluna, e
     * a mesma do esquema de entrada — sem isso, uma pergunta entrada
     * por um cliente antigo ficava sem sítio nenhum.
     */
    it('põe na geral a pergunta de quem não escolheu', async () => {
        const pagina = await listar('');

        expect(
            meus(pagina, [daGeral]).map((t) => t.category),
        ).toEqual(['general']);
    });

    it('e guarda a que foi escolhida', async () => {
        const pagina = await listar('');
        const porId = new Map(meus(pagina, todos).map((t) => [t.id, t.category]));

        expect(porId.get(dasCrews)).toBe('crews');
        expect(porId.get(dosServidores)).toBe('servers');
    });

    it('diz a categoria também a quem abre a pergunta', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/forum/topics/${dasCrews}`,
        });

        expect(resposta.statusCode, resposta.body).toBe(200);
        expect(resposta.json().category).toBe('crews');
    });

    it('filtra a lista pela categoria pedida', async () => {
        const pagina = await listar('?category=crews');

        expect(meus(pagina, todos).map((t) => t.id)).toEqual([dasCrews]);
    });

    /**
     * E nenhuma outra entra. Sem isto, o filtro podia estar a não
     * filtrar coisa nenhuma e os dois casos acima passavam à mesma,
     * porque a lista traz sempre o que se procura.
     */
    it('e não traz nada de outra categoria', async () => {
        const pagina = await listar('?category=roleplay');

        expect(meus(pagina, todos)).toEqual([]);
    });

    /**
     * A contagem leva o mesmo filtro.
     *
     * Uma lista de três com um total do fórum inteiro é o mesmo erro que
     * a procura já fez: quem carrega na página 2 vê uma lista vazia sem
     * perceber porquê.
     */
    it('conta só a categoria que está a mostrar', async () => {
        const [comFiltro, semFiltro] = await Promise.all([
            listar('?category=crews'),
            listar(''),
        ]);

        expect(comFiltro.total).toBeLessThan(semFiltro.total);
        expect(comFiltro.total).toBeGreaterThanOrEqual(1);
    });

    /** E procurar dentro de uma categoria é procurar **e** filtrar. */
    it('cruza a procura com a categoria', async () => {
        const dentro = await listar(
            `?category=crews&q=${encodeURIComponent(marca)}`,
        );

        expect(meus(dentro, todos).map((t) => t.id)).toEqual([dasCrews]);

        const fora = await listar(
            `?category=servers&q=${encodeURIComponent('procura gente')}`,
        );

        expect(meus(fora, todos)).toEqual([]);
    });

    it('recusa uma categoria que não existe, ao filtrar', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: '/api/v1/forum/topics?category=memes',
        });

        expect(resposta.statusCode).toBe(400);
    });

    it('e ao perguntar', async () => {
        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/forum/topics',
            headers: auth(token),
            payload: {
                title: `Uma pergunta sem sítio ${marca}`,
                body: 'Isto não devia entrar em lado nenhum, e não entra.',
                category: 'memes',
            },
        });

        expect(resposta.statusCode).toBe(400);
    });
});
