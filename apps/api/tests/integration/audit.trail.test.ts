import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';
import { tagAoAcaso } from '../helpers/crew-tags.js';

/**
 * O rasto do que se decide sobre pessoas, contra PostgreSQL a sério.
 *
 * O registo de auditoria era escrito por meia dúzia de módulos e não
 * havia por onde o ler: nem rota, nem ecrã. E o que ele **não** escrevia
 * era precisamente a metade sobre que se discute — quem entrou, quem foi
 * posto fora, quem passou a mandar. O dinheiro estava coberto; as
 * pessoas não.
 *
 * Isto exige base de dados a sério porque o que se prova é que a escrita
 * aconteceu e continua lá depois da resposta, e não que um duplo foi
 * chamado.
 */
describe('o rasto das decisões sobre pessoas', () => {
    let app: FastifyInstance;

    const marca = `rst${Date.now().toString().slice(-8)}`;

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

    /** O rasto tal como a rota o devolve a quem gere membros. */
    const rasto = async (token = lider) => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/crews/${crewId}/history`,
            headers: auth(token),
        });

        expect(response.statusCode, response.body).toBe(200);

        return response.json() as {
            action: string;
            actorUsername: string | null;
            before: unknown;
            after: unknown;
        }[];
    };

    const acaoes = async () => (await rasto()).map((linha) => linha.action);

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        const dono = await register(`${marca}l`);
        lider = dono.token;
        liderId = dono.id;

        const outro = await register(`${marca}m`);
        membro = outro.token;
        membroId = outro.id;

        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(lider),
            payload: { name: `Rasto ${marca}`, tag: tagAoAcaso() },
        });

        expect(crew.statusCode, crew.body).toBe(201);
        crewId = crew.json().id as string;

        const pedido = await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/join`,
            headers: auth(membro),
        });

        expect(pedido.statusCode, pedido.body).toBe(202);

        const aceite = await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/requests/${membroId}/accept`,
            headers: auth(lider),
        });

        expect(aceite.statusCode, aceite.body).toBe(204);
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('regista quem foi aceite, e por quem', async () => {
        const entrada = (await rasto()).find(
            (linha) => linha.action === 'crew.member.admitted',
        );

        expect(entrada).toBeDefined();
        expect(entrada?.actorUsername).toBe(`${marca}l`);
        expect(entrada?.after).toMatchObject({
            userId: membroId,
            username: `${marca}m`,
        });
    });

    /**
     * De onde veio e para onde foi.
     *
     * Sem o "de onde", o rasto não distingue uma promoção de uma
     * despromoção — e é essa a pergunta que leva alguém a abri-lo.
     */
    it('regista de que cargo para que cargo alguém passou', async () => {
        const resposta = await app.inject({
            method: 'PUT',
            url: `/api/v1/crews/${crewId}/members/${membroId}/role`,
            headers: auth(lider),
            payload: { role: 'crew_officer' },
        });

        expect(resposta.statusCode, resposta.body).toBe(204);

        const entrada = (await rasto()).find(
            (linha) => linha.action === 'crew.member.role_changed',
        );

        expect(entrada).toBeDefined();
        expect(entrada?.before).toMatchObject({ role: 'crew_member' });
        expect(entrada?.after).toMatchObject({
            username: `${marca}m`,
            role: 'crew_officer',
        });
    });

    /**
     * O cargo que tinha fica no registo. É ele que diz o tamanho do que
     * aconteceu: pôr fora um membro e pôr fora um oficial não são a
     * mesma notícia.
     */
    it('regista quem foi posto fora, e com que cargo', async () => {
        const resposta = await app.inject({
            method: 'DELETE',
            url: `/api/v1/crews/${crewId}/members/${membroId}`,
            headers: auth(lider),
        });

        expect(resposta.statusCode, resposta.body).toBe(204);

        const entrada = (await rasto()).find(
            (linha) => linha.action === 'crew.member.removed',
        );

        expect(entrada).toBeDefined();
        expect(entrada?.before).toMatchObject({
            username: `${marca}m`,
            role: 'crew_officer',
        });
    });

    it('vem do mais recente para o mais antigo', async () => {
        const lista = await acaoes();

        expect(lista[0]).toBe('crew.member.removed');
        expect(lista.at(-1)).toBe('crew.member.admitted');
    });

    /**
     * A mesma permissão de responder às candidaturas. Aberto a qualquer
     * membro, era publicar dentro da crew quem recusou quem.
     */
    it('não se abre a quem não gere membros', async () => {
        const forasteiro = await register(`${marca}f`);

        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/crews/${crewId}/history`,
            headers: auth(forasteiro.token),
        });

        expect(resposta.statusCode, resposta.body).toBe(403);
    });

    it('exige conta', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/crews/${crewId}/history`,
        });

        expect(resposta.statusCode).toBe(401);
    });

    /**
     * O rasto é desta crew e de mais nenhuma. Sem isto, a rota podia
     * devolver o registo inteiro da plataforma a quem gere uma crew
     * qualquer.
     */
    /**
     * Uma decisão de filiação fica nos rastos **das duas** comunidades.
     *
     * São duas perguntas diferentes com donos diferentes. Quem manda no
     * servidor quer saber que crews aceitou e pôs fora; quem lidera a
     * crew, ao dar com ela fora de um servidor, quer saber quem a tirou
     * de lá — e essa pessoa não é da crew, por isso o rasto da crew
     * nunca lhe chegaria se a entrada só ficasse do lado do servidor.
     */
    describe('as decisões de filiação', () => {
        let serverId: string;
        let outraCrew: string;

        const rastoDe = async (url: string) => {
            const resposta = await app.inject({
                method: 'GET',
                url,
                headers: auth(lider),
            });

            expect(resposta.statusCode, resposta.body).toBe(200);

            return resposta.json() as {
                action: string;
                actorUsername: string | null;
                after: unknown;
            }[];
        };

        beforeAll(async () => {
            const servidor = await app.inject({
                method: 'POST',
                url: '/api/v1/servers',
                headers: auth(lider),
                payload: { name: `Rasto ${marca}` },
            });

            expect(servidor.statusCode, servidor.body).toBe(201);
            serverId = servidor.json().id as string;

            const crew = await app.inject({
                method: 'POST',
                url: '/api/v1/crews',
                headers: auth(lider),
                payload: { name: `Filiada ${marca}`, tag: tagAoAcaso() },
            });

            expect(crew.statusCode, crew.body).toBe(201);
            outraCrew = crew.json().id as string;

            const pedido = await app.inject({
                method: 'POST',
                url: `/api/v1/crews/${outraCrew}/affiliation`,
                headers: auth(lider),
                payload: { serverId },
            });

            expect(pedido.statusCode, pedido.body).toBe(201);

            const aceite = await app.inject({
                method: 'POST',
                url: `/api/v1/servers/${serverId}/affiliations/${outraCrew}/accept`,
                headers: auth(lider),
            });

            expect(aceite.statusCode, aceite.body).toBe(200);
        });

        it('fica no rasto do servidor, com o nome da crew', async () => {
            const entrada = (
                await rastoDe(`/api/v1/servers/${serverId}/history`)
            ).find((linha) => linha.action === 'server.affiliation.accepted');

            expect(entrada).toBeDefined();
            expect(entrada?.actorUsername).toBe(`${marca}l`);
            expect(entrada?.after).toMatchObject({
                crewId: outraCrew,
                crewName: `Filiada ${marca}`,
            });
        });

        it('fica no rasto da crew, com o nome do servidor', async () => {
            const entrada = (
                await rastoDe(`/api/v1/crews/${outraCrew}/history`)
            ).find((linha) => linha.action === 'crew.affiliation.accepted');

            expect(entrada).toBeDefined();
            expect(entrada?.after).toMatchObject({
                serverId,
                serverName: `Rasto ${marca}`,
            });
        });

        /**
         * Pôr uma crew fora é a decisão que mais precisa de rasto do
         * lado dela: quem a tirou não é da crew, e sem isto a crew via
         * apenas que já não joga ali.
         */
        it('pôr a crew fora fica nos dois lados', async () => {
            const fora = await app.inject({
                method: 'DELETE',
                url: `/api/v1/servers/${serverId}/affiliations/${outraCrew}`,
                headers: auth(lider),
            });

            expect(fora.statusCode, fora.body).toBe(204);

            const doServidor = await rastoDe(
                `/api/v1/servers/${serverId}/history`,
            );
            const daCrew = await rastoDe(`/api/v1/crews/${outraCrew}/history`);

            expect(
                doServidor.some(
                    (linha) => linha.action === 'server.affiliation.removed',
                ),
            ).toBe(true);
            expect(
                daCrew.some(
                    (linha) => linha.action === 'crew.affiliation.removed',
                ),
            ).toBe(true);
        });
    });

    it('não mostra o que aconteceu noutra crew', async () => {
        const outraCrew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(lider),
            payload: { name: `Outra ${marca}`, tag: tagAoAcaso() },
        });

        expect(outraCrew.statusCode, outraCrew.body).toBe(201);

        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/crews/${outraCrew.json().id}/history`,
            headers: auth(lider),
        });

        expect(resposta.statusCode, resposta.body).toBe(200);
        expect(resposta.json()).toEqual([]);
    });

    it('o autor sai identificado por quem é, e não só pelo identificador', async () => {
        const entrada = (await rasto())[0];

        expect(entrada?.actorUsername).toBe(`${marca}l`);
        expect(liderId).toBeDefined();
    });
});
