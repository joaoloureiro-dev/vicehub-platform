import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * Procurar no fórum, contra PostgreSQL a sério.
 *
 * Aqui não há duplo que sirva: o que está em causa é o que o `contains`
 * do Prisma faz com maiúsculas, com uma palavra a meio de outra e com o
 * texto de quem já não tem conta — e isso é o Postgres a responder, não
 * o Prisma. Um duplo diria que o filtro foi montado, que é a parte que
 * já se sabe.
 *
 * A contagem tem o seu próprio caso. Uma procura que devolve três
 * tópicos e diz «página 1 de 9» está a contar o fórum inteiro, e quem
 * carrega na página 2 vê uma lista vazia sem perceber porquê.
 */
describe('procurar no fórum', () => {
    let app: FastifyInstance;

    const marca = `pr${Date.now().toString().slice(-7)}`;
    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let quem: { token: string; nome: string };

    const abrir = async (titulo: string, corpo: string) => {
        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/forum/topics',
            headers: auth(quem.token),
            payload: { title: titulo, body: corpo },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return resposta.json().id as string;
    };

    const procurar = async (termo: string) => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/forum/topics?q=${encodeURIComponent(termo)}`,
        });

        expect(resposta.statusCode, resposta.body).toBe(200);

        return resposta.json() as {
            topics: { id: string; title: string }[];
            total: number;
            pages: number;
        };
    };

    /** Só o que esta corrida escreveu: a base traz tópicos de outras. */
    const meus = (
        pagina: { topics: { id: string; title: string }[] },
        ids: string[],
    ) => pagina.topics.filter((t) => ids.includes(t.id)).map((t) => t.title);

    let doTitulo: string;
    let doCorpo: string;
    let deOutraCoisa: string;
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

        quem = {
            token: resposta.json().accessToken as string,
            nome: marca,
        };

        doTitulo = await abrir(
            `Noite de corridas ${marca}`,
            'Alguém alinha na sexta? Levo dois carros.',
        );

        doCorpo = await abrir(
            `Pergunta sobre a tesouraria ${marca}`,
            `Quem paga as corridas quando a crew inteira alinha? ${marca}`,
        );

        deOutraCoisa = await abrir(
            `Onde se compram coletes ${marca}`,
            `Procuro quatro, e pago bem. ${marca}`,
        );

        todos = [doTitulo, doCorpo, deOutraCoisa];
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('encontra pelo título', async () => {
        const pagina = await procurar(`Noite de corridas ${marca}`);

        expect(meus(pagina, todos)).toEqual([`Noite de corridas ${marca}`]);
    });

    /**
     * E pelo corpo, que é metade da razão de isto existir: quem procura
     * uma resposta procura a palavra que a resposta tem, e essa está
     * quase sempre no texto e não no título.
     */
    it('e pelo corpo', async () => {
        const pagina = await procurar(`a crew inteira alinha? ${marca}`);

        expect(meus(pagina, todos)).toEqual([
            `Pergunta sobre a tesouraria ${marca}`,
        ]);
    });

    /**
     * Sem distinguir maiúsculas. Quem escreve numa caixa de procura não
     * escreve com maiúsculas, e exigi-las é recusar por uma tecla.
     */
    it('sem ligar a maiúsculas', async () => {
        const pagina = await procurar(`NOITE DE CORRIDAS ${marca}`);

        expect(meus(pagina, todos)).toEqual([`Noite de corridas ${marca}`]);
    });

    /**
     * E o plural encontra o singular.
     *
     * É a razão de isto ser `contains` e não um índice de texto sem
     * radicalizador: «corrida» não encontraria «corridas», e o fórum tem
     * quatro idiomas sem dizer qual é o de cada tópico.
     */
    it('e uma palavra dentro de outra', async () => {
        const pagina = await procurar('corrida');
        const encontrados = meus(pagina, todos);

        expect(encontrados).toContain(`Noite de corridas ${marca}`);
        expect(encontrados).toContain(`Pergunta sobre a tesouraria ${marca}`);
    });

    it('e não traz o que não tem nada a ver', async () => {
        const pagina = await procurar(`coletes ${marca}`);

        expect(meus(pagina, todos)).toEqual([`Onde se compram coletes ${marca}`]);
    });

    /**
     * O caso que dá razão a metade do código: a contagem tem de contar o
     * que a lista filtrou, e não o fórum inteiro.
     */
    it('conta o que encontrou, e não o fórum todo', async () => {
        const tudo = await app.inject({
            method: 'GET',
            url: '/api/v1/forum/topics',
        });

        const total = (tudo.json() as { total: number }).total;
        const pagina = await procurar(`coletes ${marca}`);

        expect(pagina.total).toBe(1);
        expect(pagina.pages).toBe(1);
        expect(total).toBeGreaterThan(pagina.total);
    });

    it('e sem procura devolve tudo na mesma', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: '/api/v1/forum/topics',
        });

        const pagina = resposta.json() as {
            topics: { id: string }[];
            total: number;
        };

        expect(pagina.total).toBeGreaterThanOrEqual(3);
        expect(meus(pagina as never, todos).length).toBeGreaterThan(0);
    });

    /**
     * Um tópico retirado não aparece numa procura.
     *
     * Parece óbvio e é exatamente o tipo de coisa que um filtro novo
     * desfaz sem dar por isso: basta o `is_deleted` ficar de fora do
     * `where` quando alguém junta o `OR` da procura.
     */
    it('não devolve o que foi retirado', async () => {
        const apagar = await app.inject({
            method: 'DELETE',
            url: `/api/v1/forum/topics/${deOutraCoisa}`,
            headers: auth(quem.token),
        });

        expect(apagar.statusCode, apagar.body).toBe(204);

        const pagina = await procurar(`coletes ${marca}`);

        expect(meus(pagina, todos)).toEqual([]);
        expect(pagina.total).toBe(0);
    });
});
