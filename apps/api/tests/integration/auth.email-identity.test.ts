import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * O email identifica a conta, e a caixa das letras não faz parte dessa
 * identidade.
 *
 * Contra a base de dados a sério porque é a restrição de unicidade do
 * `email` que faz o trabalho final: um duplo em memória diria que sim a
 * um segundo registo que o PostgreSQL recusa.
 */
describe('identidade por email', () => {
    let app: FastifyInstance;

    const marca = `mail${Date.now()}`;
    const email = `${marca}@vicehub.test`;
    const password = 'Sup3rS3cret!Pass';

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        const registo = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: { email: email.toUpperCase(), username: marca, password },
        });

        expect(registo.statusCode, registo.body).toBe(201);
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('grava o email em minúsculas, mesmo escrito em maiúsculas', async () => {
        const utilizador = await prisma.user.findFirstOrThrow({
            where: { username: marca },
            select: { email: true },
        });

        expect(utilizador.email).toBe(email);
    });

    /**
     * Sem normalizar, isto criava uma segunda conta para a mesma caixa
     * de correio — e a primeira ficava inalcançável para quem escrevesse
     * o email de outra maneira.
     */
    it('recusa um segundo registo com a mesma caixa noutra grafia', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: `${marca.toUpperCase()}@ViceHub.test`,
                username: `${marca}b`,
                password,
            },
        });

        expect(response.statusCode, response.body).toBe(409);
        expect(response.json().code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it.each([
        ['tudo em maiúsculas', (valor: string) => valor.toUpperCase()],
        ['caixa misturada', (valor: string) => `${valor[0]?.toUpperCase()}${valor.slice(1)}`],
        ['com espaços à volta', (valor: string) => `  ${valor}  `],
    ])('entra na conta com o email %s', async (_nome, transformar) => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: { email: transformar(email), password },
        });

        expect(response.statusCode, response.body).toBe(200);
        expect(response.json().user.email).toBe(email);
    });
});
