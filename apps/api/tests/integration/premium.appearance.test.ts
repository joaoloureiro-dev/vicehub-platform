import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { ENTITLING_SUBSCRIPTION_STATUSES, prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';
import { FEATURED_SLOTS } from '../../src/shared/featured.js';

/**
 * O que a subscrição desbloqueia, contra PostgreSQL a sério.
 *
 * O requirePremium é um preHandler: nenhum duplo prova que ele está
 * ligado à rota certa nem que devolve 402 a quem não paga. Estes testes
 * fazem os pedidos verdadeiros — sem plano, com plano, e com o plano já
 * terminado — porque é essa a única forma de saber que a funcionalidade
 * paga está, de facto, fechada a quem não paga.
 */
describe('personalização de perfil, funcionalidade do plano', () => {
    let app: FastifyInstance;

    const marca = `prem${Date.now()}`;

    let semPlano: string;
    let comPlano: string;
    let comPlanoId: string;
    let crewId: string;
    let liderCrew: string;

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

    const userIdOf = async (token: string): Promise<string> => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/users/me',
            headers: auth(token),
        });

        expect(response.statusCode, response.body).toBe(200);

        return response.json().id as string;
    };

    /**
     * Concede um período de plano diretamente na base de dados.
     *
     * A rota de concessão exige system:manage, que é uma questão à parte;
     * o que aqui se quer verificar é o efeito de haver plano, não quem o
     * pode conceder.
     */
    const grant = (
        owner: { userId?: string; crewId?: string },
        periodEnd: Date,
        periodStart = new Date('2026-01-01T00:00:00.000Z'),
    ) =>
        prisma.subscription.create({
            data: {
                userId: owner.userId ?? null,
                crewId: owner.crewId ?? null,
                price_cents: 1000,
                current_period_start: periodStart,
                current_period_end: periodEnd,
            },
        });

    const daquiAUmAno = () =>
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const setAppearance = (token: string, payload: unknown) =>
        app.inject({
            method: 'PATCH',
            url: '/api/v1/users/me/appearance',
            headers: auth(token),
            payload: payload as never,
        });

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        semPlano = await register(`${marca}n`);
        comPlano = await register(`${marca}s`);
        comPlanoId = await userIdOf(comPlano);

        await grant({ userId: comPlanoId }, daquiAUmAno());

        liderCrew = await register(`${marca}c`);

        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(liderCrew),
            payload: { name: `Premium ${marca}`, tag: `P${marca.slice(-5)}` },
        });

        expect(crew.statusCode, crew.body).toBe(201);
        crewId = crew.json().id as string;
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    describe('sem plano ativo', () => {
        it('recusa personalizar o perfil', async () => {
            const response = await setAppearance(semPlano, {
                accentColor: '#1B9AAA',
            });

            expect(response.statusCode, response.body).toBe(402);
            expect(response.json().code).toBe('SUBSCRIPTION_REQUIRED');
        });

        /**
         * A recusa tem de acontecer antes de qualquer escrita: um 402
         * com o campo já gravado seria pior do que não haver guard
         * nenhum, porque daria a ideia de que havia.
         */
        it('não grava nada ao recusar', async () => {
            await setAppearance(semPlano, { accentColor: '#1B9AAA' });

            const utilizador = await prisma.user.findFirstOrThrow({
                where: { username: `${marca}n` },
                select: { accent_color: true, banner_url: true },
            });

            expect(utilizador).toEqual({ accent_color: null, banner_url: null });
        });

        it('continua a poder alterar a bio, que é gratuita', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: '/api/v1/users/me',
                headers: auth(semPlano),
                payload: { bio: 'sem plano, com bio' },
            });

            expect(response.statusCode, response.body).toBe(200);
            expect(response.json().bio).toBe('sem plano, com bio');
        });

        it('exige conta: não há personalização anónima', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: '/api/v1/users/me/appearance',
                payload: { accentColor: '#1B9AAA' },
            });

            expect(response.statusCode).toBe(401);
        });
    });

    describe('com plano ativo', () => {
        it('grava e devolve a personalização', async () => {
            const response = await setAppearance(comPlano, {
                bannerUrl: 'https://cdn.vicehub.gg/b.png',
                accentColor: '#1B9AAA',
            });

            expect(response.statusCode, response.body).toBe(200);
            expect(response.json().appearance).toEqual({
                bannerUrl: 'https://cdn.vicehub.gg/b.png',
                accentColor: '#1B9AAA',
            });
        });

        it('mostra a personalização no perfil público', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/users/${marca}s`,
            });

            expect(response.statusCode, response.body).toBe(200);
            expect(response.json().appearance.accentColor).toBe('#1B9AAA');
        });

        it('recusa uma cor mal formada', async () => {
            const response = await setAppearance(comPlano, {
                accentColor: 'vermelho',
            });

            expect(response.statusCode, response.body).toBe(400);
        });

        it('deixa limpar um campo sem tocar no outro', async () => {
            const response = await setAppearance(comPlano, { bannerUrl: null });

            expect(response.statusCode, response.body).toBe(200);
            expect(response.json().appearance).toEqual({
                bannerUrl: null,
                accentColor: '#1B9AAA',
            });
        });
    });

    /**
     * O que acontece quando se deixa de pagar é a metade da promessa que
     * mais facilmente se parte: ou se apaga o trabalho de quem pagou, ou
     * se oferece para sempre o que se vendeu ao mês.
     */
    describe('quando o plano termina', () => {
        let expirado: string;

        beforeAll(async () => {
            expirado = await register(`${marca}x`);
            const id = await userIdOf(expirado);

            await grant({ userId: id }, daquiAUmAno());

            await app.inject({
                method: 'PATCH',
                url: '/api/v1/users/me/appearance',
                headers: auth(expirado),
                payload: { accentColor: '#C0FFEE' },
            });

            /**
             * O período passa a ter terminado ontem, como aconteceria a
             * quem deixasse de renovar.
             */
            await prisma.subscription.updateMany({
                where: { userId: id },
                data: {
                    current_period_end: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
            });
        });

        it('deixa de mostrar a personalização', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/users/${marca}x`,
            });

            expect(response.json().appearance).toEqual({
                bannerUrl: null,
                accentColor: null,
            });
        });

        it('mas não apaga o que estava gravado', async () => {
            const utilizador = await prisma.user.findFirstOrThrow({
                where: { username: `${marca}x` },
                select: { accent_color: true },
            });

            expect(utilizador.accent_color).toBe('#C0FFEE');
        });

        it('volta a mostrá-la a quem volte a subscrever', async () => {
            const id = await prisma.user
                .findFirstOrThrow({
                    where: { username: `${marca}x` },
                    select: { id: true },
                })
                .then((utilizador) => utilizador.id);

            await grant({ userId: id }, daquiAUmAno());

            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/users/${marca}x`,
            });

            expect(response.json().appearance.accentColor).toBe('#C0FFEE');
        });

        it('e volta a recusar a alteração enquanto não voltar', async () => {
            const sozinho = await register(`${marca}y`);
            const id = await userIdOf(sozinho);

            await grant(
                { userId: id },
                new Date(Date.now() - 24 * 60 * 60 * 1000),
                new Date('2026-01-01T00:00:00.000Z'),
            );

            const response = await setAppearance(sozinho, {
                accentColor: '#1B9AAA',
            });

            expect(response.statusCode, response.body).toBe(402);
        });
    });

    /**
     * Numa rota de crew há dois titulares possíveis, e a escolha errada
     * seria invisível: um líder com plano pessoal podia personalizar uma
     * crew que nunca pagou.
     */
    describe('numa crew, conta o plano da crew', () => {
        it('recusa ao líder que só tem plano pessoal', async () => {
            const id = await userIdOf(liderCrew);

            await grant({ userId: id }, daquiAUmAno());

            const response = await app.inject({
                method: 'PATCH',
                url: `/api/v1/crews/${crewId}/appearance`,
                headers: auth(liderCrew),
                payload: { accentColor: '#1B9AAA' },
            });

            expect(response.statusCode, response.body).toBe(402);
        });

        it('aceita depois de a crew ter plano', async () => {
            await grant({ crewId }, daquiAUmAno());

            const response = await app.inject({
                method: 'PATCH',
                url: `/api/v1/crews/${crewId}/appearance`,
                headers: auth(liderCrew),
                payload: { accentColor: '#1B9AAA' },
            });

            expect(response.statusCode, response.body).toBe(200);
            expect(response.json().appearance.accentColor).toBe('#1B9AAA');
        });

        /**
         * Ter plano não faz de ninguém líder. A crew paga, e um estranho
         * continua a não lhe poder mexer no aspeto.
         */
        it('recusa a quem não manda na crew, mesmo com a crew paga', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: `/api/v1/crews/${crewId}/appearance`,
                headers: auth(comPlano),
                payload: { accentColor: '#000000' },
            });

            expect(response.statusCode, response.body).toBe(403);
        });

        it('põe crews pagas em destaque no diretório', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/crews?pageSize=1',
            });

            expect(response.statusCode, response.body).toBe(200);

            const destacadas = response.json().featured as {
                id: string;
                isPremium: boolean;
            }[];

            expect(destacadas.length).toBeGreaterThan(0);
            expect(destacadas.length).toBeLessThanOrEqual(FEATURED_SLOTS);

            /**
             * Um lugar de destaque só se dá a quem paga. Se alguma vez
             * saísse aqui uma crew sem plano, o que se vende deixava de
             * valer o que custa.
             */
            expect(destacadas.every((crew) => crew.isPremium)).toBe(true);
        });

        /**
         * Os lugares rodam, pelo que a crew deste teste pode estar à
         * espera da sua vez. O que tem de ser verdade em qualquer hora é
         * isto: ou está em destaque, ou há mais candidatas do que
         * lugares. A rotação em si é verificada onde é determinística,
         * nos testes de pickFeatured.
         */
        it('a crew paga está em destaque ou à espera da sua vez', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/crews?pageSize=1',
            });

            const destacadas = (response.json().featured as { id: string }[]).map(
                (crew) => crew.id,
            );

            const candidatas = await prisma.crew.count({
                where: {
                    is_deleted: false,
                    subscriptions: {
                        some: {
                            is_deleted: false,
                            status: { in: [...ENTITLING_SUBSCRIPTION_STATUSES] },
                            current_period_end: { gt: new Date() },
                        },
                    },
                },
            });

            expect(
                destacadas.includes(crewId) || candidatas > FEATURED_SLOTS,
            ).toBe(true);
        });

        /**
         * Quem pesquisa procura uma crew concreta; responder-lhe com
         * colocação paga tornaria a pesquisa pouco fiável.
         */
        it('não devolve destaques numa pesquisa', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/crews?search=Premium%20${marca}`,
            });

            expect(response.json().featured).toEqual([]);
        });
    });
});
