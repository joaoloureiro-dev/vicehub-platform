import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

const run = promisify(execFile);

/**
 * Como é que alguém passa a poder administrar a plataforma.
 *
 * Esta pergunta esteve sem resposta: `system:manage` guardava a
 * concessão de subscrições e **nada no sistema atribuía o cargo que a
 * concede**. A funcionalidade estava lá e não era chamável por ninguém.
 *
 * Nenhuma rota o pode conceder — a primeira conta capaz de nomear
 * administradores seria a própria porta que o cargo existe para guardar.
 * A porta é o acesso à base de dados, e é isso que este teste exercita:
 * o guião a sério, contra PostgreSQL a sério.
 */
describe('nomear administradores', () => {
    let app: FastifyInstance;

    const marca = `adm${Date.now()}`;
    const email = `${marca}@vicehub.test`;

    let token: string;
    let userId: string;
    let alvoId: string;

    const auth = {
        get authorization() {
            return `Bearer ${token}`;
        },
    };

    /**
     * O guião corre como o utilizador o corre: por npm, no package de
     * dados, com o DATABASE_URL do ambiente. Chamar as funções por
     * dentro não provaria que o comando existe nem que está bem ligado.
     */
    const admin = (comando: string, ...args: string[]) =>
        run('npm', ['run', '--silent', `admin:${comando}`, '--', ...args], {
            cwd: path.resolve(import.meta.dirname, '../../../../packages/database'),
            env: process.env,
        });

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
            userId: response.json().user.id as string,
        };
    };

    const grantLifetime = () =>
        app.inject({
            method: 'POST',
            url: '/api/v1/subscriptions/grant',
            headers: auth,
            payload: { ownerKind: 'user', ownerId: alvoId, plan: 'lifetime' },
        });

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        const conta = await register(marca);

        token = conta.token;
        userId = conta.userId;

        alvoId = (await register(`${marca}x`)).userId;
    });

    afterAll(async () => {
        await admin('revoke', email).catch(() => undefined);
        await app.close();
        await prisma.$disconnect();
    });

    /**
     * É este o teste que representa o problema encontrado: uma conta
     * acabada de criar não pode conceder subscrições, e sem o guião não
     * havia como passar deste ponto.
     */
    it('uma conta normal não concede subscrições', async () => {
        const response = await grantLifetime();

        expect(response.statusCode, response.body).toBe(403);
        expect(response.json().missingPermissions).toEqual(['system:manage']);
    });

    it('o guião promove, e o mesmo pedido passa a valer', async () => {
        const { stdout } = await admin('grant', email);

        expect(stdout).toContain('passou a administrador');

        const response = await grantLifetime();

        expect(response.statusCode, response.body).toBe(201);
        expect(response.json().plan).toBe('lifetime');
    });

    it('promover duas vezes não duplica o cargo', async () => {
        const { stdout } = await admin('grant', email);

        expect(stdout).toContain('já é administrador');

        const atribuicoes = await prisma.userRole.count({
            where: {
                userId,
                crewId: null,
                serverId: null,
                is_deleted: false,
                role: { slug: 'admin' },
            },
        });

        expect(atribuicoes).toBe(1);
    });

    /**
     * O email é normalizado como na autenticação: quem escrever o
     * próprio email com outra caixa tem de encontrar a mesma conta.
     */
    it('encontra a conta com o email escrito noutra caixa', async () => {
        const { stdout } = await admin('grant', email.toUpperCase());

        expect(stdout).toContain('já é administrador');
    });

    it('recusa um email sem conta, em vez de criar uma', async () => {
        await expect(
            admin('grant', `naoexiste-${marca}@vicehub.test`),
        ).rejects.toThrow(/Não existe conta/);
    });

    it('retirar o cargo fecha outra vez a porta', async () => {
        const { stdout } = await admin('revoke', email);

        expect(stdout).toContain('deixou de ser administrador');

        const response = await grantLifetime();

        expect(response.statusCode, response.body).toBe(403);
    });

    /**
     * Uma atribuição retirada é reaproveitada em vez de duplicada, para
     * que o histórico não se multiplique a cada ida e volta.
     */
    it('voltar a promover reaproveita a atribuição anterior', async () => {
        await admin('grant', email);

        const linhas = await prisma.userRole.count({
            where: { userId, crewId: null, serverId: null, role: { slug: 'admin' } },
        });

        expect(linhas).toBe(1);

        const response = await grantLifetime();

        expect(response.statusCode, response.body).toBe(201);
    });
});
