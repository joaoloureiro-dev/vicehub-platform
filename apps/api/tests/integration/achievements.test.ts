import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * As conquistas, contra PostgreSQL a sério.
 *
 * O que aqui se prova não é que as medalhas aparecem. É que **não podem
 * fazer perder xp**.
 *
 * São gravadas dentro da mesma transação que paga o evento, e uma
 * conquista repetida é o caso normal: quem apareceu ao segundo evento já
 * tinha a do primeiro. Se essa segunda escrita rebentasse contra o
 * índice único, levava a transação inteira com ela — e o xp do evento
 * desaparecia por causa de uma medalha. Isso não se vê com duplos.
 */
describe('conquistas', () => {
    let app: FastifyInstance;

    const marca = `cq${Date.now().toString().slice(-8)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let lider: string;
    let liderId: string;
    let membro: string;
    let membroId: string;
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
        };
    };

    /** Marca um evento, confirma os dois, e conclui-o. */
    const correrUmEvento = async (n: number): Promise<void> => {
        const evento = await app.inject({
            method: 'POST',
            url: `/api/v1/events/crews/${crewId}`,
            headers: auth(lider),
            payload: {
                name: `Assalto ${marca}-${n}`,
                startsAt: new Date(Date.now() + 86_400_000).toISOString(),
            },
        });

        expect(evento.statusCode, evento.body).toBe(201);

        const eventId = evento.json().id as string;

        for (const pessoa of [
            { token: lider, id: liderId },
            { token: membro, id: membroId },
        ]) {
            expect(
                (
                    await app.inject({
                        method: 'POST',
                        url: `/api/v1/events/crews/${crewId}/${eventId}/signup`,
                        headers: auth(pessoa.token),
                    })
                ).statusCode,
            ).toBe(204);

            expect(
                (
                    await app.inject({
                        method: 'POST',
                        url: `/api/v1/events/crews/${crewId}/${eventId}/participants/${pessoa.id}/confirm`,
                        headers: auth(lider),
                        payload: {},
                    })
                ).statusCode,
            ).toBe(204);
        }

        const fim = await app.inject({
            method: 'POST',
            url: `/api/v1/events/crews/${crewId}/${eventId}/status`,
            headers: auth(lider),
            payload: { status: 'completed' },
        });

        expect(fim.statusCode, fim.body).toBe(200);
    };

    const conquistasDe = (dono: { userId: string } | { crewId: string }) =>
        prisma.achievement.findMany({
            where: { ...dono, is_deleted: false },
            select: { slug: true },
            orderBy: { slug: 'asc' },
        });

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        const l = await register(`l${marca}`);
        lider = l.token;
        liderId = l.id;

        const m = await register(`m${marca}`);
        membro = m.token;
        membroId = m.id;

        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(lider),
            payload: { name: `Crew ${marca}`, tag: `C${marca.slice(-6)}` },
        });

        expect(crew.statusCode, crew.body).toBe(201);
        crewId = crew.json().id as string;

        /** O membro entra, para haver duas presenças e o evento contar. */
        expect(
            (
                await app.inject({
                    method: 'POST',
                    url: `/api/v1/crews/${crewId}/join`,
                    headers: auth(membro),
                })
            ).statusCode,
        ).toBe(202);

        expect(
            (
                await app.inject({
                    method: 'POST',
                    url: `/api/v1/crews/${crewId}/requests/${membroId}/accept`,
                    headers: auth(lider),
                })
            ).statusCode,
        ).toBe(204);
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('dá a primeira a quem aparece, e à crew que a correu', async () => {
        await correrUmEvento(1);

        expect(await conquistasDe({ userId: liderId })).toEqual([
            { slug: 'attended_1' },
        ]);

        expect(await conquistasDe({ crewId })).toEqual([{ slug: 'ran_1' }]);
    });

    /**
     * O caso que justifica tudo isto.
     *
     * Ao segundo evento, quem apareceu já tem a conquista do primeiro. A
     * escrita repetida tem de ser engolida em silêncio — e o xp do
     * evento tem de entrar na mesma. Se a transação caísse, o xp ficava
     * onde estava.
     */
    it('um segundo evento não perde xp por a medalha já existir', async () => {
        const antes = await prisma.crew.findFirstOrThrow({
            where: { id: crewId },
            select: { xp: true },
        });

        await correrUmEvento(2);

        const depois = await prisma.crew.findFirstOrThrow({
            where: { id: crewId },
            select: { xp: true },
        });

        expect(depois.xp).toBeGreaterThan(antes.xp);

        /** E continua a haver uma só, e não duas. */
        expect(await conquistasDe({ crewId })).toEqual([{ slug: 'ran_1' }]);
    });

    it('não deixa a mesma conquista ser ganha duas vezes', async () => {
        await expect(
            prisma.achievement.create({
                data: { crewId, slug: 'ran_1' },
            }),
        ).rejects.toThrow();
    });

    /**
     * Exatamente um titular. Uma conquista que fosse de uma pessoa **e**
     * de uma crew ao mesmo tempo não teria onde aparecer, e uma que não
     * fosse de ninguém era lixo na tabela.
     */
    it('recusa uma conquista sem dono, e uma com dois', async () => {
        await expect(
            prisma.achievement.create({ data: { slug: 'attended_1' } }),
        ).rejects.toThrow();

        await expect(
            prisma.achievement.create({
                data: { userId: liderId, crewId, slug: 'attended_1' },
            }),
        ).rejects.toThrow();
    });

    it('guarda quando cada uma foi ganha', async () => {
        const primeira = await prisma.achievement.findFirstOrThrow({
            where: { crewId, slug: 'ran_1' },
            select: { earned_at: true },
        });

        expect(primeira.earned_at).toBeInstanceOf(Date);
    });

    /**
     * Pagar aos seus é o facto que uma crew tem de mais difícil de
     * fingir: correr um evento é marcá-lo e confirmar presenças; pagar é
     * tirar dinheiro da tesouraria e pô-lo nas carteiras de outras
     * pessoas.
     *
     * A conquista entra na mesma transação que move o dinheiro, e é
     * essa a razão de isto ser um teste de integração: com duplos,
     * "na mesma transação" não quer dizer nada.
     */
    describe('pagar aos seus', () => {
        /** Põe dinheiro na tesouraria da crew, por proposta e aprovação. */
        const encher = async (quanto: string): Promise<void> => {
            const proposta = await app.inject({
                method: 'POST',
                url: `/api/v1/treasury/crews/${crewId}/movements`,
                headers: auth(lider),
                payload: {
                    amount: quanto,
                    direction: 'credit',
                    category: 'contribution',
                    description: 'Ganhos',
                },
            });

            expect(proposta.statusCode, proposta.body).toBe(201);

            const aprovacao = await app.inject({
                method: 'POST',
                url: `/api/v1/treasury/crews/${crewId}/movements/${proposta.json().id}/approve`,
                headers: auth(lider),
            });

            expect(aprovacao.statusCode, aprovacao.body).toBe(200);
        };

        /** Divide e aprova, devolvendo o saldo da crew depois de pagar. */
        const pagar = async (quanto: string): Promise<bigint> => {
            const divisao = await app.inject({
                method: 'POST',
                url: `/api/v1/treasury/crews/${crewId}/distributions`,
                headers: auth(lider),
                payload: { total: quanto, basis: 'equal' },
            });

            expect(divisao.statusCode, divisao.body).toBe(201);

            const aprovada = await app.inject({
                method: 'POST',
                url: `/api/v1/treasury/crews/${crewId}/distributions/${divisao.json().id}/approve`,
                headers: auth(lider),
            });

            expect(aprovada.statusCode, aprovada.body).toBe(200);

            const carteira = await prisma.wallet.findFirstOrThrow({
                where: { crewId, is_deleted: false },
                select: { balance: true },
            });

            return carteira.balance;
        };

        it('dá a conquista à crew que pagou pela primeira vez', async () => {
            await encher('10000');
            await pagar('1000');

            expect(
                (await conquistasDe({ crewId })).map((c) => c.slug),
            ).toContain('paid_1');
        });

        /**
         * O mesmo caso que justifica o `skipDuplicates` no xp, agora no
         * dinheiro: ao segundo pagamento a medalha já existe, e a
         * escrita repetida não pode levar a divisão inteira com ela. Se
         * levasse, ninguém era pago por causa de uma medalha.
         */
        /**
         * Propor não é pagar.
         *
         * Uma divisão escrita e nunca aprovada não moveu dinheiro
         * nenhum, e contá-la deixava uma crew ganhar a medalha por
         * escrever intenções — dez propostas por aprovar valiam o mesmo
         * que dez pagamentos feitos.
         *
         * O teste propõe as que faltam para chegar ao degrau seguinte,
         * não aprova nenhuma — **e depois paga a sério uma vez**. Essa
         * última parte não é enfeite: a contagem só acontece dentro da
         * transação que aprova, por isso sem uma aprovação a seguir as
         * propostas nunca chegavam a ser contadas e o teste passava
         * sozinho, dissesse o código o que dissesse.
         */
        it('não conta divisões que ninguém aprovou', async () => {
            await encher('100000');

            for (let i = 0; i < 9; i += 1) {
                const proposta = await app.inject({
                    method: 'POST',
                    url: `/api/v1/treasury/crews/${crewId}/distributions`,
                    headers: auth(lider),
                    payload: { total: '100', basis: 'equal' },
                });

                expect(proposta.statusCode, proposta.body).toBe(201);
            }

            expect(
                await prisma.distribution.count({
                    where: { wallet: { crewId }, is_deleted: false },
                }),
            ).toBeGreaterThanOrEqual(10);

            /** Agora sim: uma aprovação, que é o que dispara a contagem. */
            await pagar('1000');

            expect(
                (await conquistasDe({ crewId })).map((c) => c.slug),
            ).not.toContain('paid_10');
        });

        it('um segundo pagamento não se perde por a medalha já existir', async () => {
            const antes = await prisma.wallet.findFirstOrThrow({
                where: { crewId, is_deleted: false },
                select: { balance: true },
            });

            const depois = await pagar('1000');

            expect(depois).toBeLessThan(antes.balance);

            expect(
                (await conquistasDe({ crewId })).filter(
                    (c) => c.slug === 'paid_1',
                ),
            ).toHaveLength(1);
        });
    });

    /**
     * O nível de uma crew não é a contagem de eventos com outro nome: o
     * xp de um evento depende de quantas pessoas apareceram, e duas
     * crews com os mesmos eventos podem estar em níveis diferentes.
     *
     * O xp é semeado à mão em vez de se correrem dez eventos a sério. O
     * que aqui interessa provar não é a curva — isso tem testes seus —
     * mas que o degrau é dado a partir do nível que a escrita do evento
     * calcula. Esse caminho continua a ser o real: é o evento que soma,
     * recalcula e decide.
     */
    describe('subir de nível', () => {
        it('não dá o degrau a uma crew que ainda não lá chegou', async () => {
            expect(
                (await conquistasDe({ crewId })).map((c) => c.slug),
            ).not.toContain('level_5');
        });

        it('dá o degrau quando o evento a leva ao nível', async () => {
            /** Um pouco abaixo dos 1000 que o nível 5 exige. */
            await prisma.crew.update({
                where: { id: crewId },
                data: { xp: 950n },
            });

            await correrUmEvento(3);

            const crew = await prisma.crew.findFirstOrThrow({
                where: { id: crewId },
                select: { level: true },
            });

            expect(crew.level).toBeGreaterThanOrEqual(5);

            expect(
                (await conquistasDe({ crewId })).map((c) => c.slug),
            ).toContain('level_5');
        });

        /**
         * Uma pessoa não recebe medalhas de nível, e é de propósito: só
         * ganha xp a aparecer a eventos, e sempre ao mesmo ritmo, por
         * isso o nível dela é a contagem de presenças com outro nome.
         * Premiar as duas coisas era premiar o mesmo facto duas vezes.
         */
        it('não dá conquistas de nível a uma pessoa', async () => {
            await prisma.user.update({
                where: { id: liderId },
                data: { xp: 5000n },
            });

            await correrUmEvento(4);

            expect(
                (await conquistasDe({ userId: liderId })).map((c) => c.slug),
            ).not.toContain('level_5');
        });
    });

    /**
     * E aparecem nos dois perfis públicos, que é onde servem para
     * alguma coisa: quem está a decidir se aceita uma pessoa, ou se se
     * candidata a uma crew, é quem precisa de as ver.
     */
    describe('nos perfis', () => {
        it('aparecem no perfil público da pessoa', async () => {
            const resposta = await app.inject({
                method: 'GET',
                url: `/api/v1/users/l${marca}`,
            });

            expect(resposta.statusCode, resposta.body).toBe(200);

            const { achievements } = resposta.json() as {
                achievements: { slug: string; earnedAt: string }[];
            };

            expect(achievements.map((c) => c.slug)).toContain('attended_1');
            expect(achievements[0]?.earnedAt).toBeTypeOf('string');
        });

        it('e no perfil público da crew', async () => {
            const resposta = await app.inject({
                method: 'GET',
                url: `/api/v1/crews/${crewId}`,
            });

            expect(resposta.statusCode, resposta.body).toBe(200);

            const { achievements } = resposta.json() as {
                achievements: { slug: string }[];
            };

            expect(achievements.map((c) => c.slug)).toContain('ran_1');
        });

        /**
         * Sem conquistas nenhumas vem lista vazia, e não campo em falta:
         * quem consome não precisa de dois caminhos para o mesmo perfil.
         */
        it('vêm como lista vazia a quem ainda não tem nenhuma', async () => {
            const novo = await register(`n${marca}`);

            const resposta = await app.inject({
                method: 'GET',
                url: `/api/v1/users/n${marca}`,
            });

            expect(resposta.json().achievements).toEqual([]);
            expect(novo.id).toBeTypeOf('string');
        });
    });
});
