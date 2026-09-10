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
