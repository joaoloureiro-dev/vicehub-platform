import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * As duas sondas que um deploy usa, contra PostgreSQL a sério.
 *
 * Havia só uma rota e ela respondia `ok` sem perguntar nada a ninguém.
 * Uma instância sem base de dados — em baixo, inalcançável, ou com as
 * migrações por correr — dizia na mesma que estava bem, e o balanceador
 * continuava a mandar-lhe gente. É uma mentira que só se descobre com o
 * produto já a receber tráfego.
 */
describe('as sondas de saúde', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    /**
     * Vivo é "o processo responde", e é de propósito que não pergunta à
     * base de dados: uma sonda de vida a falhar faz o orquestrador
     * **reiniciar** o processo, o que não conserta a base de dados.
     */
    it('a de vida responde sem depender de nada', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: '/api/v1/health',
        });

        expect(resposta.statusCode).toBe(200);
        expect(resposta.json().status).toBe('ok');
    });

    it('a de prontidão diz que está pronta quando a base responde', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: '/api/v1/health/ready',
        });

        expect(resposta.statusCode, resposta.body).toBe(200);
        expect(resposta.json()).toEqual({
            status: 'ready',
            checks: { database: 'ok' },
        });
    });

    /**
     * O caso que dá razão de ser a tudo isto.
     *
     * 503 e não 500: não está avariado, está indisponível — e é essa a
     * palavra que um balanceador entende como "não me mandes tráfego
     * agora, volta a perguntar daqui a pouco".
     */
    it('diz que não está pronta quando a base não responde', async () => {
        const consulta = vi
            .spyOn(prisma, '$queryRaw')
            .mockRejectedValueOnce(new Error('sem ligação'));

        try {
            const resposta = await app.inject({
                method: 'GET',
                url: '/api/v1/health/ready',
            });

            expect(resposta.statusCode).toBe(503);
            expect(resposta.json()).toEqual({
                status: 'not_ready',
                checks: { database: 'down' },
            });
        } finally {
            consulta.mockRestore();
        }
    });

    /**
     * E não publica o que correu mal. Uma sonda é pública — não leva
     * sessão nenhuma —, e o texto de um erro do driver pode nomear o
     * servidor, a base ou o utilizador da ligação.
     */
    it('não deixa escapar o erro da base de dados', async () => {
        const consulta = vi
            .spyOn(prisma, '$queryRaw')
            .mockRejectedValueOnce(
                new Error('connect ECONNREFUSED 10.0.0.7:5432 vicehub_prod'),
            );

        try {
            const resposta = await app.inject({
                method: 'GET',
                url: '/api/v1/health/ready',
            });

            expect(resposta.body).not.toContain('ECONNREFUSED');
            expect(resposta.body).not.toContain('vicehub_prod');
            expect(resposta.body).not.toContain('10.0.0.7');
        } finally {
            consulta.mockRestore();
        }
    });

    /**
     * A sonda não deixa temporizadores para trás.
     *
     * O limite de espera é feito com um `setTimeout` que corre em
     * paralelo com a consulta. Quando a consulta ganha, esse
     * temporizador tem de ser cancelado — senão cada sondagem deixa um
     * handle vivo durante dois segundos, e uma sonda corre de dez em
     * dez segundos para sempre. O estrago não é memória: é o
     * encerramento gracioso, que fica à espera do que ainda está
     * agendado enquanto o orquestrador conta os segundos que deu.
     */
    it('não deixa temporizadores pendurados atrás de si', async () => {
        const temporizadores = (): number =>
            process
                .getActiveResourcesInfo()
                .filter((recurso) => recurso === 'Timeout').length;

        const antes = temporizadores();

        for (let i = 0; i < 3; i += 1) {
            const resposta = await app.inject({
                method: 'GET',
                url: '/api/v1/health/ready',
            });

            expect(resposta.statusCode).toBe(200);
        }

        expect(temporizadores()).toBe(antes);
    });

    /**
     * Uma sonda pendurada é tão má como uma que mente: o orquestrador
     * fica sem resposta e acaba por decidir pelo timeout dele, que
     * costuma ser muito mais longo do que o nosso.
     */
    it('desiste em vez de ficar pendurada à espera da base', async () => {
        const consulta = vi
            .spyOn(prisma, '$queryRaw')
            .mockImplementationOnce(
                () => new Promise(() => {
                    /* nunca resolve, como uma ligação que ficou presa */
                }) as ReturnType<typeof prisma.$queryRaw>,
            );

        try {
            const comecou = Date.now();

            const resposta = await app.inject({
                method: 'GET',
                url: '/api/v1/health/ready',
            });

            expect(resposta.statusCode).toBe(503);
            expect(Date.now() - comecou).toBeLessThan(5_000);
        } finally {
            consulta.mockRestore();
        }
    });
});
