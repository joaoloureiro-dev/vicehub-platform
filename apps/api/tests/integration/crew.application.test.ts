import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * A candidatura, das palavras de quem a escreve até aos olhos de quem
 * decide.
 *
 * Pedir entrada era um botão que não mandava nada: do outro lado
 * aparecia um nome numa lista, e quem decidia escolhia entre aceitar um
 * desconhecido ou recusar um desconhecido.
 *
 * O que estes testes fixam é o caminho inteiro — o que se escreve chega
 * intacto, chega **só a quem manda na crew**, e continua lá depois de
 * respondido.
 */
describe('a candidatura a uma crew', () => {
    let app: FastifyInstance;

    const marca = `ap${Date.now().toString().slice(-8)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let lider: string;
    let candidato: string;
    let estranho: string;
    let crewId: string;

    const CARTA = 'Tenho 22 anos, jogo à noite\ne uso microfone.';

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

    const candidatar = (token: string, payload?: Record<string, unknown>) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/join`,
            headers: auth(token),
            ...(payload === undefined ? {} : { payload }),
        });

    const listar = (token: string) =>
        app.inject({
            method: 'GET',
            url: `/api/v1/crews/${crewId}/requests`,
            headers: auth(token),
        });

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        lider = await register(`li${marca}`);
        candidato = await register(`ca${marca}`);
        estranho = await register(`es${marca}`);

        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(lider),
            payload: { name: `Crew ${marca}`, tag: `C${marca.slice(-6)}` },
        });

        expect(crew.statusCode, crew.body).toBe(201);
        crewId = crew.json().id as string;
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('leva o que a pessoa escreveu até quem decide', async () => {
        expect((await candidatar(candidato, { message: CARTA })).statusCode).toBe(202);

        const resposta = await listar(lider);

        expect(resposta.statusCode, resposta.body).toBe(200);

        const pedidos = resposta.json() as { username: string; message: string | null }[];
        const meu = pedidos.find((pedido) => pedido.username === `ca${marca}`);

        expect(meu?.message).toBe(CARTA);
    });

    /**
     * As quebras de linha contam. Uma candidatura chega quase sempre em
     * parágrafos, e achatá-la numa linha só faz de um texto pensado uma
     * papa que ninguém lê.
     */
    it('não achata o que foi escrito em várias linhas', async () => {
        const pedidos = (await listar(lider)).json() as { message: string | null }[];

        expect(pedidos.some((pedido) => pedido.message?.includes('\n'))).toBe(true);
    });

    /**
     * A carta é para quem decide, e não para o diretório.
     *
     * Alguém escreve ali coisas sobre si — idade, horários, por vezes o
     * país. Isso é para os olhos de quem responde à candidatura, e de
     * mais ninguém.
     */
    it('não a mostra a quem não manda na crew', async () => {
        const resposta = await listar(estranho);

        expect(resposta.statusCode).toBe(403);
    });

    it('nem a quem nem sessão tem', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/crews/${crewId}/requests`,
        });

        expect(resposta.statusCode).toBe(401);
    });

    /**
     * Escrever é opcional. Uma crew sem requisitos escritos não tem por
     * que exigir uma redação, e obrigar a escrever punha uma porta onde
     * não havia nenhuma.
     */
    it('deixa candidatar-se sem escrever nada', async () => {
        const outro = await register(`ou${marca}`);

        expect((await candidatar(outro)).statusCode).toBe(202);

        const pedidos = (await listar(lider)).json() as {
            username: string;
            message: string | null;
        }[];

        expect(
            pedidos.find((pedido) => pedido.username === `ou${marca}`)?.message,
        ).toBeNull();
    });

    /**
     * Aceitar não apaga a carta. É o que permite, meses depois,
     * perceber com que ideia é que alguém entrou.
     */
    it('guarda-a depois de a candidatura ser aceite', async () => {
        const userId = await prisma.user
            .findFirstOrThrow({
                where: { username: `ca${marca}` },
                select: { id: true },
            })
            .then((utilizador) => utilizador.id);

        const aceite = await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/requests/${userId}/accept`,
            headers: auth(lider),
        });

        expect(aceite.statusCode, aceite.body).toBe(204);

        const adesao = await prisma.membership.findFirstOrThrow({
            where: { crewId, userId, is_deleted: false },
            select: { status: true, message: true },
        });

        expect(adesao.status).toBe('active');
        expect(adesao.message).toBe(CARTA);
    });

    it('recusa uma carta absurdamente longa', async () => {
        const outro = await register(`lo${marca}`);

        const resposta = await candidatar(outro, { message: 'x'.repeat(2001) });

        expect(resposta.statusCode).toBe(400);

        expect(
            await prisma.membership.count({
                where: {
                    crewId,
                    user: { username: `lo${marca}` },
                    is_deleted: false,
                },
            }),
        ).toBe(0);
    });

    /**
     * A outra metade: a resposta chega a quem se candidatou.
     *
     * Era aqui que estava o buraco maior. Uma candidatura recusada
     * desaparecia da lista de quem a fez — pedia-se entrada, esperava-se,
     * e um dia o pedido já lá não estava. A pessoa nunca chegava a saber
     * que tinha sido recusada, que é exatamente a queixa que se ouve
     * sobre comunidades em todo o lado.
     */
    describe('a recusa', () => {
        let recusado: string;
        let recusadoId: string;

        beforeAll(async () => {
            recusado = await register(`re${marca}`);

            expect(
                (await candidatar(recusado, { message: 'Deixem-me entrar.' }))
                    .statusCode,
            ).toBe(202);

            recusadoId = await prisma.user
                .findFirstOrThrow({
                    where: { username: `re${marca}` },
                    select: { id: true },
                })
                .then((utilizador) => utilizador.id);

            const resposta = await app.inject({
                method: 'POST',
                url: `/api/v1/crews/${crewId}/requests/${recusadoId}/reject`,
                headers: auth(lider),
                payload: { reason: 'Estamos cheios este mês. Volta em outubro.' },
            });

            expect(resposta.statusCode, resposta.body).toBe(204);
        });

        it('aparece a quem se candidatou, com o motivo', async () => {
            const resposta = await app.inject({
                method: 'GET',
                url: '/api/v1/crews/me/memberships',
                headers: auth(recusado),
            });

            expect(resposta.statusCode, resposta.body).toBe(200);

            const minhas = resposta.json() as {
                crewId: string;
                status: string;
                decisionNote: string | null;
                respondedAt: string | null;
            }[];

            const esta = minhas.find((adesao) => adesao.crewId === crewId);

            expect(esta?.status).toBe('rejected');
            expect(esta?.decisionNote).toBe(
                'Estamos cheios este mês. Volta em outubro.',
            );
            expect(esta?.respondedAt).toBeTypeOf('string');
        });

        /**
         * O motivo é para quem foi recusado, e não para o mundo. Um
         * "não entras porque não confiamos em ti" no diretório seria
         * pior do que o silêncio que isto veio resolver.
         */
        it('não a mostra a mais ninguém', async () => {
            const resposta = await app.inject({
                method: 'GET',
                url: '/api/v1/crews/me/memberships',
                headers: auth(estranho),
            });

            expect(resposta.statusCode).toBe(200);

            const minhas = resposta.json() as { crewId: string }[];

            expect(minhas.some((adesao) => adesao.crewId === crewId)).toBe(false);
        });

        /**
         * Recusar não fecha a porta para sempre: a candidatura recusada
         * não conta como pedido aberto, e quem foi recusado pode voltar
         * a candidatar-se.
         */
        it('não impede uma nova candidatura', async () => {
            expect((await candidatar(recusado)).statusCode).toBe(202);
        });

        /**
         * E uma recusa antiga não fica lá para sempre a encher a lista.
         * Trinta dias depois sai — "foste recusado a semana passada" diz
         * alguma coisa, "foste recusado há dois anos" não diz nada.
         */
        it('some da lista passado o prazo', async () => {
            await prisma.membership.updateMany({
                where: { crewId, userId: recusadoId, status: 'rejected' },
                data: {
                    responded_at: new Date(
                        Date.now() - 31 * 24 * 60 * 60 * 1000,
                    ),
                },
            });

            const minhas = (
                await app.inject({
                    method: 'GET',
                    url: '/api/v1/crews/me/memberships',
                    headers: auth(recusado),
                })
            ).json() as { crewId: string; status: string }[];

            expect(
                minhas.some(
                    (adesao) =>
                        adesao.crewId === crewId && adesao.status === 'rejected',
                ),
            ).toBe(false);
        });
    });

    /**
     * O mesmo, num servidor.
     *
     * Não é zelo a mais: as duas rotas partilham a tabela e o esquema, e
     * uma plataforma onde candidatar-se a uma crew leva as tuas palavras
     * e candidatar-se a um servidor não leva é uma plataforma que se
     * contradiz a si própria. Quem der por isso não vai supor que foi de
     * propósito.
     */
    describe('e num servidor, do mesmo modo', () => {
        let serverId: string;
        let aspirante: string;

        beforeAll(async () => {
            aspirante = await register(`sv${marca}`);

            const servidor = await app.inject({
                method: 'POST',
                url: '/api/v1/servers',
                headers: auth(lider),
                payload: { name: `Servidor ${marca}` },
            });

            expect(servidor.statusCode, servidor.body).toBe(201);
            serverId = servidor.json().id as string;
        });

        it('leva a carta até quem decide', async () => {
            const pedido = await app.inject({
                method: 'POST',
                url: `/api/v1/servers/${serverId}/join`,
                headers: auth(aspirante),
                payload: { message: 'Jogo desde 2019.' },
            });

            expect(pedido.statusCode, pedido.body).toBe(202);

            const pedidos = (
                await app.inject({
                    method: 'GET',
                    url: `/api/v1/servers/${serverId}/requests`,
                    headers: auth(lider),
                })
            ).json() as { username: string; message: string | null }[];

            expect(
                pedidos.find((entrada) => entrada.username === `sv${marca}`)
                    ?.message,
            ).toBe('Jogo desde 2019.');
        });

        it('e a recusa volta com o motivo', async () => {
            const userId = await prisma.user
                .findFirstOrThrow({
                    where: { username: `sv${marca}` },
                    select: { id: true },
                })
                .then((utilizador) => utilizador.id);

            const recusa = await app.inject({
                method: 'POST',
                url: `/api/v1/servers/${serverId}/requests/${userId}/reject`,
                headers: auth(lider),
                payload: { reason: 'Sem vagas de momento.' },
            });

            expect(recusa.statusCode, recusa.body).toBe(204);

            const minhas = (
                await app.inject({
                    method: 'GET',
                    url: '/api/v1/servers/me/memberships',
                    headers: auth(aspirante),
                })
            ).json() as {
                serverId: string;
                status: string;
                decisionNote: string | null;
            }[];

            const esta = minhas.find((adesao) => adesao.serverId === serverId);

            expect(esta?.status).toBe('rejected');
            expect(esta?.decisionNote).toBe('Sem vagas de momento.');
        });

        it('e o pedido sem corpo continua a passar', async () => {
            const outro = await register(`s2${marca}`);

            const pedido = await app.inject({
                method: 'POST',
                url: `/api/v1/servers/${serverId}/join`,
                headers: auth(outro),
            });

            expect(pedido.statusCode, pedido.body).toBe(202);
        });
    });
});
