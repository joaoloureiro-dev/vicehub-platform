import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * A filiação entre uma crew e um servidor, contra PostgreSQL a sério.
 *
 * É a peça de que vai depender o direito ao plano do servidor, e por
 * isso o que aqui interessa provar não é que o caminho feliz funciona:
 * é que **uma crew não se pendura sozinha num servidor**. A declaração
 * de uma só parte não vale, e um líder de crew não aceita a sua própria
 * crew num servidor que não gere.
 */
describe('filiação entre crews e servidores', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    /** Lidera a crew. */
    let lider: string;
    /** Manda no servidor. */
    let dono: string;

    let crewId: string;
    let serverId: string;
    /** Um segundo servidor, de outra pessoa. */
    let outroServerId: string;
    let outroDono: string;

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

    const criarCrew = async (token: string, sufixo: string): Promise<string> => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(token),
            payload: { name: `Crew ${sufixo}`, tag: `C${sufixo}`.slice(0, 8) },
        });

        expect(response.statusCode, response.body).toBe(201);

        return response.json().id as string;
    };

    const criarServidor = async (
        token: string,
        sufixo: string,
    ): Promise<string> => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/servers',
            headers: auth(token),
            payload: { name: `Server ${sufixo}` },
        });

        expect(response.statusCode, response.body).toBe(201);

        return response.json().id as string;
    };

    const pedir = (token: string, crew: string, servidor: string) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crew}/affiliation`,
            headers: auth(token),
            payload: { serverId: servidor },
        });

    const aceitar = (token: string, servidor: string, crew: string) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/servers/${servidor}/affiliations/${crew}/accept`,
            headers: auth(token),
        });

    const estadoDaCrew = async (crew: string) => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/crews/${crew}/affiliation`,
        });

        expect(response.statusCode, response.body).toBe(200);

        return response.json() as {
            server: { id: string; name: string } | null;
            pending: { id: string; name: string } | null;
        };
    };

    /** Repõe a crew sem filiação nenhuma, para cada caso partir do mesmo sítio. */
    const limpar = () =>
        prisma.affiliation.deleteMany({ where: { crewId } });

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        lider = await register(`afl${marca}`);
        dono = await register(`afd${marca}`);
        outroDono = await register(`afo${marca}`);

        crewId = await criarCrew(lider, marca);
        serverId = await criarServidor(dono, marca);
        outroServerId = await criarServidor(outroDono, `outro${marca}`);
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    describe('só as duas pontas juntas criam a ligação', () => {
        it('o pedido da crew fica pendente, sem servidor nenhum', async () => {
            await limpar();

            const response = await pedir(lider, crewId, serverId);

            expect(response.statusCode, response.body).toBe(201);

            const estado = await estadoDaCrew(crewId);

            expect(estado.server).toBeNull();
            expect(estado.pending?.id).toBe(serverId);
        });

        /**
         * O caso que dá nome a tudo isto: se bastasse pedir, pendurar
         * uma crew no plano de um servidor era escrever um identificador.
         */
        it('quem lidera a crew não a aceita no servidor de outra pessoa', async () => {
            await limpar();
            await pedir(lider, crewId, serverId);

            const response = await aceitar(lider, serverId, crewId);

            expect(response.statusCode, response.body).toBe(403);
            expect((await estadoDaCrew(crewId)).server).toBeNull();
        });

        it('quem manda no servidor aceita, e aí sim a crew joga lá', async () => {
            await limpar();
            await pedir(lider, crewId, serverId);

            const response = await aceitar(dono, serverId, crewId);

            expect(response.statusCode, response.body).toBe(200);

            const estado = await estadoDaCrew(crewId);

            expect(estado.server?.id).toBe(serverId);
            expect(estado.pending).toBeNull();
        });

        it('o dono de outro servidor não responde por este', async () => {
            await limpar();
            await pedir(lider, crewId, serverId);

            const response = await aceitar(outroDono, serverId, crewId);

            expect(response.statusCode, response.body).toBe(403);
        });

        it('não se pede sem sessão', async () => {
            await limpar();

            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/crews/${crewId}/affiliation`,
                payload: { serverId },
            });

            expect(response.statusCode).toBe(401);
        });
    });

    describe('uma crew joga num servidor, não em dois', () => {
        it('recusa um pedido novo enquanto a crew já joga algures', async () => {
            await limpar();
            await pedir(lider, crewId, serverId);
            await aceitar(dono, serverId, crewId);

            const response = await pedir(lider, crewId, outroServerId);

            expect(response.statusCode, response.body).toBe(409);
            expect(response.json().code).toBe('CREW_ALREADY_AFFILIATED');
        });

        /**
         * O caso que a verificação em memória não apanha: dois pedidos
         * feitos antes de qualquer resposta, e dois servidores a
         * aceitarem. É para isto que existe o índice único parcial.
         */
        it('dois servidores não aceitam a mesma crew', async () => {
            await limpar();
            await pedir(lider, crewId, serverId);
            await pedir(lider, crewId, outroServerId);

            const primeiro = await aceitar(dono, serverId, crewId);
            const segundo = await aceitar(outroDono, outroServerId, crewId);

            expect(primeiro.statusCode, primeiro.body).toBe(200);
            expect(segundo.statusCode, segundo.body).toBe(409);

            const ativas = await prisma.affiliation.count({
                where: { crewId, status: 'active', is_deleted: false },
            });

            expect(ativas).toBe(1);
        });

        /**
         * O mesmo, mas em simultâneo — que é o caso que a verificação em
         * memória não pode apanhar, por mais bem escrita que esteja: as
         * duas leem "esta crew não joga em lado nenhum" antes de
         * qualquer das duas escrever. Quem decide é o índice único
         * parcial, e a recusa tem de sair como recusa e não como avaria.
         */
        it('dois servidores a aceitarem ao mesmo tempo: só um passa', async () => {
            await limpar();
            await pedir(lider, crewId, serverId);
            await pedir(lider, crewId, outroServerId);

            const [primeiro, segundo] = await Promise.all([
                aceitar(dono, serverId, crewId),
                aceitar(outroDono, outroServerId, crewId),
            ]);

            const aceites = [primeiro, segundo].filter(
                (resposta) => resposta.statusCode === 200,
            );

            expect(aceites).toHaveLength(1);

            const recusado = [primeiro, segundo].find(
                (resposta) => resposta.statusCode !== 200,
            );

            expect(recusado?.statusCode, recusado?.body).toBe(409);
            expect(recusado?.json().code).toBe('CREW_ALREADY_AFFILIATED');

            const ativas = await prisma.affiliation.count({
                where: { crewId, status: 'active', is_deleted: false },
            });

            expect(ativas).toBe(1);
        });

        it('recusa um segundo pedido ao mesmo servidor', async () => {
            await limpar();
            await pedir(lider, crewId, serverId);

            const response = await pedir(lider, crewId, serverId);

            expect(response.statusCode, response.body).toBe(409);
            expect(response.json().code).toBe('AFFILIATION_ALREADY_REQUESTED');
        });
    });

    describe('desfazer', () => {
        it('a crew desiste do pedido', async () => {
            await limpar();
            await pedir(lider, crewId, serverId);

            const response = await app.inject({
                method: 'DELETE',
                url: `/api/v1/crews/${crewId}/affiliation/request`,
                headers: auth(lider),
            });

            expect(response.statusCode, response.body).toBe(204);
            expect((await estadoDaCrew(crewId)).pending).toBeNull();
        });

        it('a crew sai do servidor, e pode entrar noutro depois', async () => {
            await limpar();
            await pedir(lider, crewId, serverId);
            await aceitar(dono, serverId, crewId);

            const saida = await app.inject({
                method: 'DELETE',
                url: `/api/v1/crews/${crewId}/affiliation`,
                headers: auth(lider),
            });

            expect(saida.statusCode, saida.body).toBe(204);

            const novo = await pedir(lider, crewId, outroServerId);

            expect(novo.statusCode, novo.body).toBe(201);
        });

        it('o servidor põe fora uma crew que lá jogava', async () => {
            await limpar();
            await pedir(lider, crewId, serverId);
            await aceitar(dono, serverId, crewId);

            const response = await app.inject({
                method: 'DELETE',
                url: `/api/v1/servers/${serverId}/affiliations/${crewId}`,
                headers: auth(dono),
            });

            expect(response.statusCode, response.body).toBe(204);
            expect((await estadoDaCrew(crewId)).server).toBeNull();
        });

        /**
         * Um pedido recusado é história, não uma porta fechada: a crew
         * pode voltar a pedir mais tarde. É por isso que os índices
         * únicos da tabela são parciais sobre os estados abertos.
         */
        it('depois de recusada, a crew pode voltar a pedir', async () => {
            await limpar();
            await pedir(lider, crewId, serverId);

            const recusa = await app.inject({
                method: 'POST',
                url: `/api/v1/servers/${serverId}/affiliations/${crewId}/reject`,
                headers: auth(dono),
            });

            expect(recusa.statusCode, recusa.body).toBe(200);

            const outraVez = await pedir(lider, crewId, serverId);

            expect(outraVez.statusCode, outraVez.body).toBe(201);
        });
    });

    describe('as listas do servidor', () => {
        it('mostra publicamente as crews que lá jogam', async () => {
            await limpar();
            await pedir(lider, crewId, serverId);
            await aceitar(dono, serverId, crewId);

            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/servers/${serverId}/affiliations`,
            });

            expect(response.statusCode, response.body).toBe(200);
            expect(response.json()).toHaveLength(1);
            expect(response.json()[0].crewName).toBe(`Crew ${marca}`);
        });

        /**
         * Quem pediu para entrar não é público: é a caixa de entrada de
         * quem gere o servidor.
         */
        it('não mostra a quem passa os pedidos por responder', async () => {
            await limpar();
            await pedir(lider, crewId, serverId);

            const anonimo = await app.inject({
                method: 'GET',
                url: `/api/v1/servers/${serverId}/affiliations/requests`,
            });

            expect(anonimo.statusCode).toBe(401);

            const alheio = await app.inject({
                method: 'GET',
                url: `/api/v1/servers/${serverId}/affiliations/requests`,
                headers: auth(lider),
            });

            expect(alheio.statusCode).toBe(403);

            const proprio = await app.inject({
                method: 'GET',
                url: `/api/v1/servers/${serverId}/affiliations/requests`,
                headers: auth(dono),
            });

            expect(proprio.statusCode, proprio.body).toBe(200);
            expect(proprio.json()).toHaveLength(1);
        });

        it('a lista pública não inclui quem só pediu', async () => {
            await limpar();
            await pedir(lider, crewId, serverId);

            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/servers/${serverId}/affiliations`,
            });

            expect(response.statusCode, response.body).toBe(200);
            expect(response.json()).toEqual([]);
        });
    });
});
