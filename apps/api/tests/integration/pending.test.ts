import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';
import { darPlano, tirarPlano } from '../helpers/plans.fixtures.js';
import { tagAoAcaso } from '../helpers/crew-tags.js';

/**
 * O que está à espera de mim, contra PostgreSQL a sério.
 *
 * Duas perguntas, e a segunda é a que importa mais: **está cá tudo o
 * que me espera?** e **não está cá nada que eu não possa fazer?**
 *
 * A segunda é a que faz desta caixa de entrada uma coisa segura. Contar
 * os pedidos de uma crew a quem não os pode aceitar não seria só um
 * botão inútil: seria contar-lhe quantas pessoas se andam a candidatar
 * a uma crew onde ela não manda.
 */
describe('o que está à espera de mim', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    /** Lidera a crew e manda no servidor. */
    let lider: string;
    /** Um membro sem poderes de gestão. */
    let membro: string;
    /** Alguém de fora, que pede para entrar. */
    let candidato: string;

    let crewId: string;
    let serverId: string;

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

    const pendentes = async (token: string) => {
        const resposta = await app.inject({
            method: 'GET',
            url: '/api/v1/users/me/pending',
            headers: auth(token),
        });

        expect(resposta.statusCode, resposta.body).toBe(200);

        return resposta.json() as {
            items: {
                kind: string;
                communityId: string;
                communityName: string;
                count: number;
            }[];
            friendRequests: number;
            answers: number;
            answersSeenAt: string | null;
            total: number;
        };
    };

    const marcarVistas = async (token: string) => {
        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/users/me/pending/answers/seen',
            headers: auth(token),
        });

        expect(resposta.statusCode, resposta.body).toBe(204);
    };

    const dosTipos = (
        dados: Awaited<ReturnType<typeof pendentes>>,
        kind: string,
    ) => dados.items.filter((item) => item.kind === kind);

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        lider = await register(`lid${marca}`);
        membro = await register(`mem${marca}`);
        candidato = await register(`can${marca}`);

        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(lider),
            payload: { name: `Espera ${marca}`, tag: tagAoAcaso() },
        });

        expect(crew.statusCode, crew.body).toBe(201);
        crewId = crew.json().id as string;

        const servidor = await app.inject({
            method: 'POST',
            url: '/api/v1/servers',
            headers: auth(lider),
            payload: { name: `Servidor ${marca}` },
        });

        expect(servidor.statusCode, servidor.body).toBe(201);
        serverId = servidor.json().id as string;

        /** O membro entra e é aceite: fica lá dentro, sem mandar. */
        await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/join`,
            headers: auth(membro),
            payload: {},
        });

        const perfilMembro = await app.inject({
            method: 'GET',
            url: '/api/v1/users/me',
            headers: auth(membro),
        });

        await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/requests/${perfilMembro.json().id as string}/accept`,
            headers: auth(lider),
        });

        /** E o candidato pede, e fica à espera. */
        const pedido = await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/join`,
            headers: auth(candidato),
            payload: {},
        });

        expect(pedido.statusCode, pedido.body).toBe(202);
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    /**
     * O outro lado da caixa.
     *
     * Tudo o resto aqui é trabalho meu — há alguém à espera de mim.
     * Isto é o contrário: **eu** estive à espera, e a resposta chegou.
     * Sem isto, candidatar-se era um sítio sem volta — quem foi aceite
     * não sabia que já podia entrar, e quem foi recusado continuava à
     * espera de uma resposta que já lá estava.
     */
    describe('as respostas às minhas candidaturas', () => {
        it('conta a resposta para quem se candidatou, e não para quem respondeu', async () => {
            const novo = await register(`resp${marca}`);

            await app.inject({
                method: 'POST',
                url: `/api/v1/crews/${crewId}/join`,
                headers: auth(novo),
                payload: {},
            });

            const perfil = await app.inject({
                method: 'GET',
                url: '/api/v1/users/me',
                headers: auth(novo),
            });

            const antesDeResponder = await pendentes(novo);
            expect(antesDeResponder.answers).toBe(0);

            await app.inject({
                method: 'POST',
                url: `/api/v1/crews/${crewId}/requests/${perfil.json().id as string}/accept`,
                headers: auth(lider),
            });

            const depois = await pendentes(novo);

            expect(depois.answers).toBe(1);
            expect(depois.total).toBeGreaterThanOrEqual(1);

            /*
             * Quem respondeu não ganha nada com isto: a resposta é dele
             * e ele já sabe que a deu.
             */
            const doLider = await pendentes(lider);
            expect(doLider.answers).toBe(0);
        });

        it('uma recusa conta tanto como um aceite', async () => {
            const novo = await register(`recu${marca}`);

            await app.inject({
                method: 'POST',
                url: `/api/v1/crews/${crewId}/join`,
                headers: auth(novo),
                payload: {},
            });

            const perfil = await app.inject({
                method: 'GET',
                url: '/api/v1/users/me',
                headers: auth(novo),
            });

            await app.inject({
                method: 'POST',
                url: `/api/v1/crews/${crewId}/requests/${perfil.json().id as string}/reject`,
                headers: auth(lider),
                payload: { reason: 'Procuramos gente com mais horas.' },
            });

            expect((await pendentes(novo)).answers).toBe(1);
        });

        it('deixa de contar depois de eu ir ver, e não volta', async () => {
            const novo = await register(`vist${marca}`);

            await app.inject({
                method: 'POST',
                url: `/api/v1/crews/${crewId}/join`,
                headers: auth(novo),
                payload: {},
            });

            const perfil = await app.inject({
                method: 'GET',
                url: '/api/v1/users/me',
                headers: auth(novo),
            });

            await app.inject({
                method: 'POST',
                url: `/api/v1/crews/${crewId}/requests/${perfil.json().id as string}/accept`,
                headers: auth(lider),
            });

            expect((await pendentes(novo)).answers).toBe(1);

            await marcarVistas(novo);

            const depois = await pendentes(novo);
            expect(depois.answers).toBe(0);
            expect(depois.answersSeenAt).not.toBeNull();

            /* Marcar outra vez não é erro, e não ressuscita nada. */
            await marcarVistas(novo);
            expect((await pendentes(novo)).answers).toBe(0);
        });

        /**
         * A que chega **depois** de eu ter ido ver conta na mesma. Sem
         * isto, uma ida à página calava todas as respostas futuras.
         */
        it('uma resposta nova depois de eu ter ido ver volta a contar', async () => {
            const novo = await register(`dep${marca}`);

            await marcarVistas(novo);
            expect((await pendentes(novo)).answers).toBe(0);

            await app.inject({
                method: 'POST',
                url: `/api/v1/servers/${serverId}/join`,
                headers: auth(novo),
                payload: {},
            });

            const perfil = await app.inject({
                method: 'GET',
                url: '/api/v1/users/me',
                headers: auth(novo),
            });

            await app.inject({
                method: 'POST',
                url: `/api/v1/servers/${serverId}/requests/${perfil.json().id as string}/accept`,
                headers: auth(lider),
            });

            expect((await pendentes(novo)).answers).toBe(1);
        });

        it('quem nunca foi ver tem por ver o que já foi respondido', async () => {
            const nunca = await pendentes(candidato);

            expect(nunca.answersSeenAt).toBeNull();
        });

        /**
         * Uma crew apagada depois de me responder não conta.
         *
         * A mesma regra do resto desta caixa, e pela mesma razão: o
         * número existe para me levar a uma página, e essa página já
         * não abre. Aqui é ainda mais claro — mandar alguém ver uma
         * resposta de uma crew que deixou de existir é pior do que não
         * lhe dizer nada.
         */
        it('não conta a resposta de uma crew que entretanto foi apagada', async () => {
            const novo = await register(`apag${marca}`);

            const efemera = await app.inject({
                method: 'POST',
                url: '/api/v1/crews',
                headers: auth(lider),
                payload: {
                    name: `Efemera ${marca}`,
                    tag: tagAoAcaso(),
                },
            });

            const id = efemera.json().id as string;

            await app.inject({
                method: 'POST',
                url: `/api/v1/crews/${id}/join`,
                headers: auth(novo),
                payload: {},
            });

            const perfil = await app.inject({
                method: 'GET',
                url: '/api/v1/users/me',
                headers: auth(novo),
            });

            await app.inject({
                method: 'POST',
                url: `/api/v1/crews/${id}/requests/${perfil.json().id as string}/accept`,
                headers: auth(lider),
            });

            expect((await pendentes(novo)).answers).toBe(1);

            await prisma.crew.update({
                where: { id },
                data: { is_deleted: true, deleted_at: new Date() },
            });

            expect((await pendentes(novo)).answers).toBe(0);
        });

        /** E o mesmo do outro lado. Os dois ramos, os dois cobertos. */
        it('nem a de um servidor apagado', async () => {
            const novo = await register(`apsv${marca}`);

            const efemero = await app.inject({
                method: 'POST',
                url: '/api/v1/servers',
                headers: auth(lider),
                payload: { name: `Efemero ${marca}` },
            });

            const id = efemero.json().id as string;

            await app.inject({
                method: 'POST',
                url: `/api/v1/servers/${id}/join`,
                headers: auth(novo),
                payload: {},
            });

            const perfil = await app.inject({
                method: 'GET',
                url: '/api/v1/users/me',
                headers: auth(novo),
            });

            await app.inject({
                method: 'POST',
                url: `/api/v1/servers/${id}/requests/${perfil.json().id as string}/accept`,
                headers: auth(lider),
            });

            expect((await pendentes(novo)).answers).toBe(1);

            await prisma.server.update({
                where: { id },
                data: { is_deleted: true, deleted_at: new Date() },
            });

            expect((await pendentes(novo)).answers).toBe(0);
        });

        it('marcar como vistas exige conta', async () => {
            const resposta = await app.inject({
                method: 'POST',
                url: '/api/v1/users/me/pending/answers/seen',
            });

            expect(resposta.statusCode).toBe(401);
        });
    });

    describe('está cá o que me espera', () => {
        it('conta o pedido de entrada para quem gere a crew', async () => {
            const dados = await pendentes(lider);

            const daCrew = dosTipos(dados, 'crew_join_request');

            expect(daCrew).toHaveLength(1);
            expect(daCrew[0]).toMatchObject({
                communityId: crewId,
                communityName: `Espera ${marca}`,
                count: 1,
            });
        });

        /**
         * O nome vem junto de propósito: uma caixa de entrada que diz
         * "1 pedido" sem dizer onde obriga a procurar em todas as
         * comunidades, que é exatamente a caminhada que ela existe para
         * poupar.
         */
        it('diz em que comunidade, e não só quantos', async () => {
            const dados = await pendentes(lider);

            expect(dados.items.every((item) => item.communityName !== '')).toBe(
                true,
            );
        });

        it('soma tudo no total', async () => {
            const dados = await pendentes(lider);

            expect(dados.total).toBe(
                dados.items.reduce((soma, item) => soma + item.count, 0) +
                    dados.friendRequests,
            );
        });
    });

    describe('não está cá o que eu não posso fazer', () => {
        /**
         * **O caso que dá razão a esta suite.** O membro está na mesma
         * crew e vê a mesma página; o que ele não tem é o poder de
         * aceitar. Contar-lhe o pedido dizia-lhe quantas pessoas se
         * andam a candidatar a uma crew onde ele não manda.
         */
        it('não conta os pedidos a quem não os pode aceitar', async () => {
            const dados = await pendentes(membro);

            expect(dosTipos(dados, 'crew_join_request')).toHaveLength(0);
            expect(dados.items).toHaveLength(0);

            /*
             * O total dele não é zero, e não devia ser: este membro foi
             * aceite na crew e ainda não veio saber. O que se prova
             * aqui é que **não há trabalho nenhum à espera dele** — a
             * lista está vazia —, e não que ele não tenha notícias.
             */
            expect(dados.answers).toBe(1);
            expect(dados.total).toBe(1);
        });

        it('não conta nada a quem está de fora', async () => {
            const dados = await pendentes(candidato);

            expect(dados.items).toHaveLength(0);
            expect(dados.total).toBe(0);
        });

        /**
         * O pedido que **eu** fiz está à espera da outra pessoa, e não
         * de mim. Contá-lo aqui era pôr-me a mim na lista do que me
         * falta fazer.
         */
        it('não conta o meu próprio pedido como coisa minha a fazer', async () => {
            const dados = await pendentes(candidato);

            expect(dados.total).toBe(0);
        });

        it('exige conta', async () => {
            const resposta = await app.inject({
                method: 'GET',
                url: '/api/v1/users/me/pending',
            });

            expect(resposta.statusCode).toBe(401);
        });
    });

    describe('o dinheiro só conta com plano', () => {
        /**
         * O movimento é criado **primeiro**, e com o plano em vigor.
         *
         * Pela ordem contrária o teste do "sem plano" afirmava zero
         * quando o zero vinha de não existir movimento nenhum — uma
         * asserção que passa com o código certo e com o código errado,
         * que é o mesmo que não a ter.
         */
        it('conta uma decisão à espera numa comunidade com plano', async () => {
            const carteira = await prisma.wallet.findFirstOrThrow({
                where: { crewId, is_deleted: false },
                select: { id: true },
            });

            await prisma.transaction.create({
                data: {
                    walletId: carteira.id,
                    amount: 500n,
                    direction: 'debit',
                    category: 'other',
                    status: 'pending',
                },
            });

            const daTesouraria = dosTipos(
                await pendentes(lider),
                'treasury_decision',
            );

            expect(daTesouraria).toHaveLength(1);
            expect(daTesouraria[0]).toMatchObject({ communityId: crewId, count: 1 });
        });

        /**
         * Mexer no dinheiro exige plano, e por isso decidir também
         * exige. Sem esta condição a caixa de entrada oferecia uma
         * decisão que a API recusa — e a pessoa ia lá três vezes antes
         * de perceber que o que faltava era o plano, e não ela.
         *
         * O movimento continua lá: o que mudou foi só o plano.
         */
        it('deixa de a contar quando o plano acaba', async () => {
            await tirarPlano({ crewId });

            expect(
                dosTipos(await pendentes(lider), 'treasury_decision'),
            ).toHaveLength(0);
        });

        it('e volta a contá-la quando o plano volta', async () => {
            await darPlano({ crewId });

            expect(
                dosTipos(await pendentes(lider), 'treasury_decision'),
            ).toHaveLength(1);
        });
    });

    describe('os pedidos de amizade', () => {
        /**
         * Um pedido que **eu** mandei está à espera da outra pessoa. É
         * ela que tem de responder, e contá-lo do meu lado era pôr-me
         * na minha própria lista de coisas a fazer.
         */
        it('contam para quem os recebe, e não para quem os manda', async () => {
            const euLider = await app.inject({
                method: 'GET',
                url: '/api/v1/users/me',
                headers: auth(lider),
            });

            const antesDoLider = (await pendentes(lider)).friendRequests;
            const antesDoMembro = (await pendentes(membro)).friendRequests;

            const pedido = await app.inject({
                method: 'POST',
                url: `/api/v1/friends/${euLider.json().id as string}`,
                headers: auth(membro),
            });

            expect([200, 201, 202]).toContain(pedido.statusCode);

            /** Chegou a quem o recebeu. */
            expect((await pendentes(lider)).friendRequests).toBe(
                antesDoLider + 1,
            );

            /** E não a quem o mandou. */
            expect((await pendentes(membro)).friendRequests).toBe(
                antesDoMembro,
            );
        });

        /**
         * E entra no total, que é o número que aparece na navegação.
         * Sem isto, um pedido de amizade era a única coisa à espera que
         * não punha lá número nenhum.
         */
        it('entram no total', async () => {
            const dados = await pendentes(lider);

            expect(dados.friendRequests).toBeGreaterThan(0);
            expect(dados.total).toBe(
                dados.items.reduce((soma, item) => soma + item.count, 0) +
                    dados.friendRequests,
            );
        });
    });

    describe('comunidades que já não existem', () => {
        /**
         * Apagar uma comunidade deixa o cargo para trás. Contá-la aqui
         * mandava a pessoa para uma página que já não abre.
         */
        it('não conta uma crew apagada', async () => {
            const crewParaApagar = await app.inject({
                method: 'POST',
                url: '/api/v1/crews',
                headers: auth(lider),
                payload: {
                    name: `Fantasma ${marca}`,
                    tag: tagAoAcaso(),
                },
            });

            const id = crewParaApagar.json().id as string;

            await app.inject({
                method: 'POST',
                url: `/api/v1/crews/${id}/join`,
                headers: auth(candidato),
                payload: {},
            });

            expect(
                dosTipos(await pendentes(lider), 'crew_join_request').some(
                    (item) => item.communityId === id,
                ),
            ).toBe(true);

            await prisma.crew.update({
                where: { id },
                data: { is_deleted: true, deleted_at: new Date() },
            });

            expect(
                dosTipos(await pendentes(lider), 'crew_join_request').some(
                    (item) => item.communityId === id,
                ),
            ).toBe(false);
        });

        it('não conta um servidor apagado', async () => {
            const servidorParaApagar = await app.inject({
                method: 'POST',
                url: '/api/v1/servers',
                headers: auth(lider),
                payload: { name: `Fantasma ${marca}` },
            });

            const id = servidorParaApagar.json().id as string;

            await app.inject({
                method: 'POST',
                url: `/api/v1/servers/${id}/join`,
                headers: auth(candidato),
                payload: {},
            });

            expect(
                dosTipos(await pendentes(lider), 'server_join_request').some(
                    (item) => item.communityId === id,
                ),
            ).toBe(true);

            await prisma.server.update({
                where: { id },
                data: { is_deleted: true, deleted_at: new Date() },
            });

            expect(
                dosTipos(await pendentes(lider), 'server_join_request').some(
                    (item) => item.communityId === id,
                ),
            ).toBe(false);
        });
    });
});
