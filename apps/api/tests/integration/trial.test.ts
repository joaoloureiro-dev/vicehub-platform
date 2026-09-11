import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { DIAS_DE_AVALIACAO, prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * Os trinta dias com que uma comunidade nasce, contra PostgreSQL a
 * sério.
 *
 * A tesouraria é o que a plataforma vende, e ninguém paga por uma coisa
 * que nunca viu a funcionar com o seu próprio dinheiro e a sua própria
 * gente. Sem avaliação, o paywall não é uma oferta — é uma porta
 * fechada à chegada.
 *
 * O que aqui se prova é que a avaliação **nasce com a comunidade**, na
 * mesma escrita, e que é uma avaliação e não um plano pago: o histórico
 * tem de dizer que não foi cobrado nada.
 */
describe('a avaliação de trinta dias', () => {
    let app: FastifyInstance;

    const marca = `tr${Date.now().toString().slice(-9)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let dono: string;
    let crewId: string;
    let serverId: string;

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

        return response.json().accessToken as string;
    };

    const subscricaoDe = (owner: { crewId: string } | { serverId: string }) =>
        prisma.subscription.findFirstOrThrow({
            where: { ...owner, is_deleted: false },
            select: {
                plan: true,
                status: true,
                price_cents: true,
                current_period_end: true,
            },
        });

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        dono = await register(`d${marca}`);

        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(dono),
            payload: { name: `Crew ${marca}`, tag: `T${marca.slice(-6)}` },
        });

        expect(crew.statusCode, crew.body).toBe(201);
        crewId = crew.json().id as string;

        const servidor = await app.inject({
            method: 'POST',
            url: '/api/v1/servers',
            headers: auth(dono),
            payload: { name: `Server ${marca}` },
        });

        expect(servidor.statusCode, servidor.body).toBe(201);
        serverId = servidor.json().id as string;
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    describe('uma crew nova', () => {
        it('nasce com a avaliação já lá', async () => {
            const plano = await subscricaoDe({ crewId });

            expect(plano.status).toBe('trialing');
            expect(plano.plan).toBe('premium');
        });

        /**
         * Zero, e não o preço do plano: o histórico tem de dizer que não
         * foi cobrado nada, ou uma soma de receita passava a contar
         * dinheiro que nunca entrou.
         */
        it('não cobra nada a ninguém', async () => {
            expect((await subscricaoDe({ crewId })).price_cents).toBe(0);
        });

        it('acaba daqui a trinta dias', async () => {
            const plano = await subscricaoDe({ crewId });

            expect(plano.current_period_end).not.toBeNull();

            const dias = Math.round(
                ((plano.current_period_end as Date).getTime() - Date.now())
                / 86_400_000,
            );

            expect(dias).toBe(DIAS_DE_AVALIACAO);
        });

        /**
         * O que a avaliação existe para mostrar: a tesouraria a
         * funcionar, no primeiro dia, sem ninguém ter pago nada.
         */
        it('abre a tesouraria desde o primeiro dia', async () => {
            const resposta = await app.inject({
                method: 'POST',
                url: `/api/v1/treasury/crews/${crewId}/movements`,
                headers: auth(dono),
                payload: {
                    amount: '500',
                    direction: 'credit',
                    category: 'contribution',
                    description: 'Ganhos',
                },
            });

            expect(resposta.statusCode, resposta.body).toBe(201);
        });

        /**
         * `isPremium` é o mesmo numa avaliação e num plano pago — e é
         * suposto ser, porque dão o mesmo. O que não pode ser igual é o
         * que o ecrã diz: uma avaliação acaba, e acabar em silêncio,
         * com a tesouraria a fechar-se sem aviso, era a pior maneira de
         * vender.
         */
        it('diz que é uma avaliação, e não um plano pago', async () => {
            const resposta = await app.inject({
                method: 'GET',
                url: `/api/v1/subscriptions/crews/${crewId}`,
                headers: auth(dono),
            });

            expect(resposta.statusCode, resposta.body).toBe(200);
            expect(resposta.json().isPremium).toBe(true);
            expect(resposta.json().isTrial).toBe(true);
        });
    });

    describe('um servidor novo', () => {
        /**
         * O escalão de entrada, e não o plano de uma pessoa: o que um
         * servidor compra é o direito a ter crews a jogar lá, e uma
         * avaliação que não mostrasse esse direito não mostrava nada.
         */
        it('nasce em avaliação do escalão de entrada', async () => {
            const plano = await subscricaoDe({ serverId });

            expect(plano.status).toBe('trialing');
            expect(plano.plan).toBe('server_base');
            expect(plano.price_cents).toBe(0);
        });

        it('e vale já pelas dez crews desse escalão', async () => {
            const resposta = await app.inject({
                method: 'GET',
                url: `/api/v1/servers/${serverId}/affiliations/allowance`,
                headers: auth(dono),
            });

            expect(resposta.statusCode, resposta.body).toBe(200);
            expect(resposta.json().limit).toBe(10);
        });
    });

    /**
     * Uma avaliação não foi paga nem oferecida a ninguém. Contá-la como
     * plano ativo trancava toda a comunidade recém-criada durante trinta
     * dias — incluindo a que alguém criou por engano e quis desfazer no
     * minuto seguinte.
     */
    it('não impede apagar a comunidade', async () => {
        const outro = await register(`a${marca}`);

        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(outro),
            payload: { name: `Engano ${marca}`, tag: `E${marca.slice(-6)}` },
        });

        expect(crew.statusCode, crew.body).toBe(201);

        const apagada = await app.inject({
            method: 'DELETE',
            url: `/api/v1/crews/${crew.json().id}`,
            headers: auth(outro),
        });

        expect(apagada.statusCode, apagada.body).toBe(204);
    });

    /**
     * Uma só por comunidade. A segunda avaliação seria a primeira a não
     * valer nada — e quem quisesse renovar indefinidamente só teria de
     * deixar o plano cair.
     */
    it('não se renova quando acaba', async () => {
        await prisma.subscription.updateMany({
            where: { crewId },
            data: { status: 'canceled', ended_at: new Date() },
        });

        const resposta = await app.inject({
            method: 'POST',
            url: `/api/v1/treasury/crews/${crewId}/movements`,
            headers: auth(dono),
            payload: {
                amount: '100',
                direction: 'credit',
                category: 'contribution',
                description: 'Depois',
            },
        });

        expect(resposta.statusCode, resposta.body).toBe(402);

        expect(
            await prisma.subscription.count({
                where: { crewId, status: 'trialing' },
            }),
        ).toBe(0);
    });
});
