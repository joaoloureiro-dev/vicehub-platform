import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';
import { darPlano } from '../helpers/plans.fixtures.js';
import { tagAoAcaso } from '../helpers/crew-tags.js';

/**
 * O quadro de um servidor, contra PostgreSQL a sério.
 *
 * O cálculo do lugar tem os seus testes com duplo, onde se controla a
 * página. O que aqui não há duplo que prove é a **consulta**: que só
 * entram as filiações ativas, que a ordem é a do xp e não a da chegada,
 * que a contagem leva o mesmo filtro da lista, e que uma crew apagada
 * sai do quadro do servidor onde jogava.
 */
describe('o quadro de um servidor', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;
    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let dono: string;
    let serverId: string;

    /** As crews desta corrida, pelo apelido que lhes damos aqui. */
    const crews = new Map<string, string>();

    const register = async (username: string): Promise<string> => {
        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: `${username}@vicehub.test`,
                username,
                password: 'Sup3rS3cret!Pass',
            },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return resposta.json().accessToken as string;
    };

    /**
     * Uma crew com xp, filiada ou à espera.
     *
     * O xp é escrito diretamente na base: como ele lá chega é assunto
     * dos eventos e tem os testes deles. O que aqui se prova é o que o
     * quadro faz com ele.
     */
    const crewCom = async (
        apelido: string,
        xp: bigint,
        estado: 'active' | 'pending',
    ): Promise<string> => {
        const token = await register(`q${apelido}${marca}`);

        const criada = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(token),
            payload: { name: `Crew ${apelido} ${marca}`, tag: tagAoAcaso() },
        });

        expect(criada.statusCode, criada.body).toBe(201);

        const crewId = criada.json().id as string;

        await prisma.crew.update({ where: { id: crewId }, data: { xp } });

        const pedido = await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/affiliation`,
            headers: auth(token),
            payload: { serverId },
        });

        expect(pedido.statusCode, pedido.body).toBe(201);

        if (estado === 'active') {
            const aceite = await app.inject({
                method: 'POST',
                url: `/api/v1/servers/${serverId}/affiliations/${crewId}/accept`,
                headers: auth(dono),
            });

            expect(aceite.statusCode, aceite.body).toBe(200);
        }

        crews.set(apelido, crewId);

        return crewId;
    };

    const quadro = async (query = '') => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/servers/${serverId}/leaderboard${query}`,
        });

        expect(resposta.statusCode, resposta.body).toBe(200);

        return resposta.json() as {
            entries: {
                position: number;
                crewId: string;
                crewName: string;
                crewTag: string;
                level: number;
                xp: string;
            }[];
            page: number;
            pages: number;
            total: number;
        };
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        dono = await register(`qd${marca}`);

        const criado = await app.inject({
            method: 'POST',
            url: '/api/v1/servers',
            headers: auth(dono),
            payload: { name: `Server ${marca}` },
        });

        expect(criado.statusCode, criado.body).toBe(201);

        serverId = criado.json().id as string;

        /*
         * Sem plano, um servidor só aceita três crews. Aqui são cinco —
         * quatro a jogar e uma à espera —, e o escalão é o que abre
         * lugar para elas.
         */
        await darPlano({ serverId }, 'server_plus');

        await crewCom('alta', 900n, 'active');
        await crewCom('igual', 900n, 'active');
        await crewCom('media', 100n, 'active');
        await crewCom('zero', 0n, 'active');
        await crewCom('espera', 5_000n, 'pending');
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('põe as crews por xp, da mais alta para a mais baixa', async () => {
        const pagina = await quadro();

        expect(pagina.entries.map((linha) => linha.xp)).toEqual([
            '900',
            '900',
            '100',
            '0',
        ]);
    });

    it('e dá o mesmo lugar às que estão empatadas', async () => {
        const pagina = await quadro();

        expect(pagina.entries.map((linha) => linha.position)).toEqual([
            1, 1, 3, 4,
        ]);
    });

    /**
     * **Um pedido por responder não é uma crew que joga ali.**
     *
     * Pô-la no quadro dava a quem pediu um lugar que ainda ninguém lhe
     * deu — e, aqui, o primeiro lugar, porque é a que tem mais xp.
     */
    it('deixa de fora quem só pediu para entrar', async () => {
        const pagina = await quadro();

        expect(pagina.entries.map((linha) => linha.crewId)).not.toContain(
            crews.get('espera'),
        );
        expect(pagina.total).toBe(4);
    });

    /**
     * O nome e a etiqueta são os da crew, e não outra coisa qualquer
     * com a forma certa. Comparam-se com o que o perfil dela diz: é a
     * única maneira de distinguir "trouxe a etiqueta" de "trouxe uma
     * etiqueta".
     */
    it('diz o nome e a etiqueta que a crew tem', async () => {
        const pagina = await quadro();
        const primeira = pagina.entries[0];

        const perfil = await app.inject({
            method: 'GET',
            url: `/api/v1/crews/${primeira?.crewId}`,
        });

        expect(perfil.statusCode, perfil.body).toBe(200);
        expect(primeira?.crewName).toBe(perfil.json().name);
        expect(primeira?.crewTag).toBe(perfil.json().tag);
    });

    /**
     * O xp sai em texto. É `BigInt` na base, e um número de JavaScript
     * deixa de ser exato acima dos nove mil biliões — o mesmo motivo
     * por que a tesouraria o faz.
     */
    it('manda o xp como texto', async () => {
        const pagina = await quadro();

        expect(typeof pagina.entries[0]?.xp).toBe('string');
    });

    it('conta as páginas e responde a uma que não tem nada', async () => {
        const pagina = await quadro('?page=2');

        expect(pagina.entries).toEqual([]);
        expect(pagina.page).toBe(2);
        expect(pagina.pages).toBe(1);
        expect(pagina.total).toBe(4);
    });

    it('recusa uma página que não é uma página', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/servers/${serverId}/leaderboard?page=0`,
        });

        expect(resposta.statusCode).toBe(400);
    });

    /** Ler não pede sessão: uma classificação fechada não serve a ninguém. */
    it('responde a quem não tem sessão', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/servers/${serverId}/leaderboard`,
        });

        expect(resposta.statusCode).toBe(200);
    });

    /**
     * Uma crew apagada sai do quadro.
     *
     * A filiação fica na base — é história de que aquela crew jogou ali
     * —, mas a linha não pode continuar no quadro: mostraria um nome
     * que já não existe, e um lugar ocupado por ninguém.
     */
    it('tira do quadro a crew que foi apagada', async () => {
        const apagada = crews.get('media');

        if (apagada === undefined) {
            throw new Error('a crew do meio não foi criada');
        }

        await prisma.crew.update({
            where: { id: apagada },
            data: { is_deleted: true, deleted_at: new Date() },
        });

        const pagina = await quadro();

        expect(pagina.entries.map((linha) => linha.crewId)).not.toContain(
            apagada,
        );
        expect(pagina.total).toBe(3);
        expect(pagina.entries.map((linha) => linha.position)).toEqual([1, 1, 3]);
    });
});
