import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';
import { esquecerCatalogoDeCargos } from '../../src/shared/catalogo-de-cargos.js';
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
    /** O identificador de quem lidera, para chegar aos cargos dele. */
    let liderId: string;

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

        const perfilLider = await app.inject({
            method: 'GET',
            url: '/api/v1/users/me',
            headers: auth(lider),
        });

        expect(perfilLider.statusCode, perfilLider.body).toBe(200);
        liderId = perfilLider.json().id as string;

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

        /**
         * **E as crews que esperam para jogar no servidor.**
         *
         * É a terceira espécie desta caixa e não tinha teste nenhum: a
         * contagem e o nome estavam cobertos por tabela, mas a espécie
         * não — um pedido de filiação anunciado como pedido de entrada
         * mandava quem o fosse resolver à página errada do servidor, e
         * nada se queixava.
         */
        it('conta a crew que espera para jogar no servidor, como filiação', async () => {
            const outra = await app.inject({
                method: 'POST',
                url: '/api/v1/crews',
                headers: auth(candidato),
                payload: { name: `Quer jogar ${marca}`, tag: tagAoAcaso() },
            });

            expect(outra.statusCode, outra.body).toBe(201);

            /* Quem pede é a crew, pelo caminho dela. */
            const pedido = await app.inject({
                method: 'POST',
                url: `/api/v1/crews/${outra.json().id as string}/affiliation`,
                headers: auth(candidato),
                payload: { serverId },
            });

            expect(pedido.statusCode, pedido.body).toBe(201);

            const filiacoes = dosTipos(
                await pendentes(lider),
                'affiliation_request',
            );

            expect(filiacoes).toHaveLength(1);
            expect(filiacoes[0]).toMatchObject({
                communityKind: 'server',
                communityId: serverId,
                communityName: `Servidor ${marca}`,
                count: 1,
            });
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

        /**
         * **Um cargo que já passou do prazo não conta.**
         *
         * O guard das rotas sempre ignorou as atribuições expiradas; a
         * caixa não, e lia-as como se valessem. A diferença era uma
         * caixa a oferecer trabalho que a API recusa — quem clicasse
         * levava um 403 sem entender porquê, e o número do sino nunca
         * baixava.
         *
         * Nada grava prazo num cargo hoje, e é por isso que ninguém
         * deu por isto. O prazo mexe-se aqui na base directamente,
         * porque é o único sítio de onde ele pode vir — e é
         * precisamente o dia em que alguém der um cargo temporário que
         * este teste existe para cobrir.
         */
        it('não conta os pedidos de uma crew onde o meu cargo já expirou', async () => {
            const antes = await pendentes(lider);

            expect(dosTipos(antes, 'crew_join_request')).toHaveLength(1);

            /*
             * O cargo **dele**, e não um qualquer desta crew: o membro
             * também tem um lá dentro, e apagar o dele não lhe tira
             * poder nenhum a quem lidera. A primeira versão deste teste
             * escrevia `findFirst` sem o dono e falhou por isso.
             */
            const cargo = await prisma.userRole.findFirstOrThrow({
                where: { userId: liderId, crewId, is_deleted: false },
                select: { id: true },
            });

            await prisma.userRole.update({
                where: { id: cargo.id },
                data: { expires_at: new Date(Date.now() - 60_000) },
            });

            try {
                const durante = await pendentes(lider);

                expect(dosTipos(durante, 'crew_join_request')).toHaveLength(0);
            } finally {
                await prisma.userRole.update({
                    where: { id: cargo.id },
                    data: { expires_at: null },
                });
            }

            /* E volta quando o prazo sai. */
            const depois = await pendentes(lider);

            expect(dosTipos(depois, 'crew_join_request')).toHaveLength(1);
        });

        /**
         * **E um cargo apagado também não.**
         *
         * Apagar um cargo não apaga as atribuições dele: quem o tinha
         * continua a trazer o identificador. O catálogo de cargos
         * exclui os apagados, e é de lá que os poderes vêm — aqui
         * prova-se que vêm mesmo de lá, e não de uma segunda leitura
         * com a sua própria ideia do que conta.
         */
        it('nem os de uma crew onde o meu cargo foi apagado', async () => {
            const cargo = await prisma.userRole.findFirstOrThrow({
                where: { userId: liderId, crewId, is_deleted: false },
                select: { roleId: true },
            });

            await prisma.role.update({
                where: { id: cargo.roleId },
                data: { is_deleted: true, deleted_at: new Date() },
            });

            /* O catálogo é guardado: sem isto, leria o de antes. */
            esquecerCatalogoDeCargos();

            try {
                const durante = await pendentes(lider);

                expect(dosTipos(durante, 'crew_join_request')).toHaveLength(0);
            } finally {
                await prisma.role.update({
                    where: { id: cargo.roleId },
                    data: { is_deleted: false, deleted_at: null },
                });

                esquecerCatalogoDeCargos();
            }

            const depois = await pendentes(lider);

            expect(dosTipos(depois, 'crew_join_request')).toHaveLength(1);
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

        /**
         * **Movimentos e divisões contam juntos.**
         *
         * Para quem tem de decidir são a mesma coisa: dinheiro parado à
         * espera de um sim ou de um não. Somam-se numa contagem só, e
         * uma que trouxesse apenas os movimentos daria o mesmo número
         * de sempre com uma divisão por decidir ao lado.
         */
        it('soma as divisões aos movimentos, na mesma comunidade', async () => {
            const carteira = await prisma.wallet.findFirstOrThrow({
                where: { crewId, is_deleted: false },
                select: { id: true },
            });

            await prisma.distribution.create({
                data: {
                    walletId: carteira.id,
                    total: 900n,
                    basis: 'equal',
                    status: 'pending',
                    created_by: null,
                },
            });

            const daTesouraria = dosTipos(
                await pendentes(lider),
                'treasury_decision',
            );

            expect(daTesouraria).toHaveLength(1);
            expect(daTesouraria[0]).toMatchObject({
                communityId: crewId,
                count: 2,
            });
        });

        /**
         * **E cada comunidade leva o seu número, e não o da outra.**
         *
         * As contagens saem agrupadas por carteira — três consultas
         * para quantas comunidades forem, em vez de duas por cada — e é
         * no agrupar que se troca uma linha pela outra. Com uma
         * comunidade só, um agrupamento trocado dá na mesma o número
         * certo.
         */
        it('e dá a cada comunidade o que está à espera nela', async () => {
            const daCrew = await prisma.wallet.findFirstOrThrow({
                where: { crewId, is_deleted: false },
                select: { id: true },
            });

            const doServidor = await prisma.wallet.findFirstOrThrow({
                where: { serverId, is_deleted: false },
                select: { id: true },
            });

            await darPlano({ serverId }, 'server_base');

            /* Três no servidor, contra os dois que a crew já tem. */
            for (const _ of [1, 2, 3]) {
                await prisma.transaction.create({
                    data: {
                        walletId: doServidor.id,
                        amount: 100n,
                        direction: 'debit',
                        category: 'other',
                        status: 'pending',
                    },
                });
            }

            const porComunidade = new Map(
                dosTipos(await pendentes(lider), 'treasury_decision').map(
                    (item: { communityId: string; count: number }) =>
                        [item.communityId, item.count],
                ),
            );

            expect(porComunidade.get(crewId)).toBe(2);
            expect(porComunidade.get(serverId)).toBe(3);
            expect(daCrew.id).not.toBe(doServidor.id);
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
