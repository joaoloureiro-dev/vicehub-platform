import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * O plano de um servidor a cobrir as crews que lá jogam.
 *
 * É a peça que faz a plataforma ser vendável a um servidor: paga uma
 * vez, e as crews que aceitou ficam com o que o plano dá. Contra
 * PostgreSQL a sério, porque o que se quer provar não é o cálculo — é
 * que o direito **aparece e desaparece** com factos guardados: a
 * filiação estar ativa, e o plano do servidor estar em vigor.
 */
describe('o plano do servidor cobre as crews que lá jogam', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let lider: string;
    let dono: string;
    let crewId: string;
    let serverId: string;

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

    const daquiAUmAno = () =>
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    /** Concede um período diretamente: quem pode conceder é outra questão. */
    const darPlano = (
        owner: { crewId?: string; serverId?: string },
        periodEnd: Date | null,
        plan: 'premium' | 'lifetime' = 'premium',
    ) =>
        prisma.subscription.create({
            data: {
                crewId: owner.crewId ?? null,
                serverId: owner.serverId ?? null,
                plan,
                price_cents: 1000,
                current_period_start: new Date('2026-01-01T00:00:00.000Z'),
                current_period_end: periodEnd,
            },
        });

    const direitoDaCrew = async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/subscriptions/crews/${crewId}`,
            headers: auth(lider),
        });

        expect(response.statusCode, response.body).toBe(200);

        return response.json() as {
            isPremium: boolean;
            isLifetime: boolean;
            activeUntil: string | null;
            via: { kind: string; id: string; name: string } | null;
        };
    };

    /** O perfil público diz o mesmo que o apuramento? */
    const perfilDizPremium = async (): Promise<boolean> => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/crews/${crewId}`,
        });

        expect(response.statusCode, response.body).toBe(200);

        return response.json().isPremium as boolean;
    };

    /** A personalização é o que o plano desbloqueia: serve de prova viva. */
    const tentarPersonalizar = () =>
        app.inject({
            method: 'PATCH',
            url: `/api/v1/crews/${crewId}/appearance`,
            headers: auth(lider),
            payload: { accentColor: '#1B9AAA' },
        });

    const filiar = async () => {
        const pedido = await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/affiliation`,
            headers: auth(lider),
            payload: { serverId },
        });

        expect(pedido.statusCode, pedido.body).toBe(201);

        const aceite = await app.inject({
            method: 'POST',
            url: `/api/v1/servers/${serverId}/affiliations/${crewId}/accept`,
            headers: auth(dono),
        });

        expect(aceite.statusCode, aceite.body).toBe(200);
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        lider = await register(`csl${marca}`);
        dono = await register(`csd${marca}`);

        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(lider),
            payload: { name: `Crew ${marca}`, tag: `X${marca}`.slice(0, 8) },
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

    /** Cada caso parte sem planos e sem filiação. */
    beforeEach(async () => {
        await prisma.subscription.deleteMany({
            where: { OR: [{ crewId }, { serverId }] },
        });
        await prisma.affiliation.deleteMany({ where: { crewId } });
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('sem plano em lado nenhum, a crew não tem direito', async () => {
        expect((await direitoDaCrew()).isPremium).toBe(false);
        expect((await tentarPersonalizar()).statusCode).toBe(402);
    });

    /**
     * O caso que dá razão a tudo isto.
     */
    it('o plano do servidor dá direito à crew que lá joga', async () => {
        await darPlano({ serverId }, daquiAUmAno());
        await filiar();

        const direito = await direitoDaCrew();

        expect(direito.isPremium).toBe(true);
        expect(direito.via).toMatchObject({
            kind: 'server',
            id: serverId,
            name: `Server ${marca}`,
        });

        expect((await tentarPersonalizar()).statusCode).toBe(200);
    });

    /**
     * Pedir não é entrar. Se o pedido bastasse, pendurar uma crew no
     * plano de um servidor era escrever um identificador.
     */
    it('um pedido por responder não dá direito nenhum', async () => {
        await darPlano({ serverId }, daquiAUmAno());

        const pedido = await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/affiliation`,
            headers: auth(lider),
            payload: { serverId },
        });

        expect(pedido.statusCode, pedido.body).toBe(201);

        expect((await direitoDaCrew()).isPremium).toBe(false);
        expect((await tentarPersonalizar()).statusCode).toBe(402);
    });

    /**
     * O direito é derivado, e não gravado: sair leva-o com ele. O que
     * fica são os valores já guardados, para quando voltar a haver
     * plano — perder trabalho por sair seria um castigo.
     */
    it('a crew perde o direito ao sair do servidor, e a personalização fica guardada', async () => {
        await darPlano({ serverId }, daquiAUmAno());
        await filiar();

        expect((await tentarPersonalizar()).statusCode).toBe(200);

        const saida = await app.inject({
            method: 'DELETE',
            url: `/api/v1/crews/${crewId}/affiliation`,
            headers: auth(lider),
        });

        expect(saida.statusCode, saida.body).toBe(204);

        expect((await direitoDaCrew()).isPremium).toBe(false);
        expect((await tentarPersonalizar()).statusCode).toBe(402);

        const guardado = await prisma.crew.findFirstOrThrow({
            where: { id: crewId },
            select: { accent_color: true },
        });

        expect(guardado.accent_color).toBe('#1B9AAA');
    });

    it('o plano do servidor a terminar leva o direito da crew atrás', async () => {
        await darPlano({ serverId }, new Date('2026-01-02T00:00:00.000Z'));
        await filiar();

        expect((await direitoDaCrew()).isPremium).toBe(false);
    });

    /**
     * Um vitalício do servidor não faz a crew vitalícia: o acesso dela
     * acaba se sair de lá. Chamar-lhe vitalício prometia o que a crew
     * não tem.
     */
    it('um servidor vitalício não torna a crew vitalícia', async () => {
        await darPlano({ serverId }, null, 'lifetime');
        await filiar();

        const direito = await direitoDaCrew();

        expect(direito.isPremium).toBe(true);
        expect(direito.isLifetime).toBe(false);
        expect(direito.via?.id).toBe(serverId);
    });

    it('o plano da própria crew ganha, e não vem marcado como do servidor', async () => {
        await darPlano({ serverId }, daquiAUmAno());
        await darPlano({ crewId }, null, 'lifetime');
        await filiar();

        const direito = await direitoDaCrew();

        expect(direito.isLifetime).toBe(true);
        expect(direito.via).toBeNull();
    });

    /**
     * A mesma pergunta feita em dois sítios tem de dar a mesma resposta.
     * O diretório apura em bloco, por uma consulta diferente: sem a
     * cascata lá também, a lista dizia que a crew não tem plano e a
     * página dela dizia que tem.
     */
    it('o perfil e o diretório concordam', async () => {
        await darPlano({ serverId }, daquiAUmAno());
        await filiar();

        expect(await perfilDizPremium()).toBe(true);

        const diretorio = await app.inject({
            method: 'GET',
            url: `/api/v1/crews?search=Crew ${marca}`,
        });

        expect(diretorio.statusCode, diretorio.body).toBe(200);

        const linha = (diretorio.json().items as { id: string; isPremium: boolean }[]).find(
            (item) => item.id === crewId,
        );

        expect(linha?.isPremium).toBe(true);
    });
});
