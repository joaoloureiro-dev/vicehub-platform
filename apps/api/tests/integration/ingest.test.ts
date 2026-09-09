import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { HEARTBEAT_JANELA_MS, prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * A ingestão: o que um servidor de jogo manda para cá.
 *
 * Contra PostgreSQL a sério, porque o que se quer provar é o que a
 * chave **não** deixa acontecer — e isso depende do que está gravado:
 * que o segredo não fica em lado nenhum, que uma chave revogada deixa
 * de servir, e que uma chave de um servidor não fala pelo outro.
 */
describe('ingestão de servidores', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let dono: string;
    let alheio: string;
    let serverId: string;
    let outroServerId: string;

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

    const criarServidor = async (token: string, nome: string) => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/servers',
            headers: auth(token),
            payload: { name: nome },
        });

        expect(response.statusCode, response.body).toBe(201);

        return response.json().id as string;
    };

    const criarChave = async (
        token: string,
        servidor: string,
        label = 'produção',
    ) => {
        const response = await app.inject({
            method: 'POST',
            url: `/api/v1/servers/${servidor}/api-keys`,
            headers: auth(token),
            payload: { label },
        });

        expect(response.statusCode, response.body).toBe(201);

        return response.json() as { id: string; key: string; prefix: string };
    };

    const comChave = (chave: string) => ({ authorization: `Bearer ${chave}` });

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        dono = await register(`ing${marca}`);
        alheio = await register(`alh${marca}`);

        serverId = await criarServidor(dono, `Server ${marca}`);
        outroServerId = await criarServidor(alheio, `Outro ${marca}`);
    });

    beforeEach(async () => {
        await prisma.serverApiKey.deleteMany({ where: { serverId } });
        await prisma.server.update({
            where: { id: serverId },
            data: {
                last_heartbeat_at: null,
                players_online: null,
                isOnline: false,
            },
        });
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    describe('as chaves', () => {
        /**
         * A chave inteira aparece **uma vez**. O que fica gravado é o
         * resumo — uma base de dados lida não pode ser uma base de
         * dados que entrega os servidores todos.
         */
        it('entrega a chave uma vez, e guarda só o resumo', async () => {
            const chave = await criarChave(dono, serverId);

            expect(chave.key.startsWith('vh_')).toBe(true);

            const gravada = await prisma.serverApiKey.findFirstOrThrow({
                where: { id: chave.id },
                select: { key_hash: true, prefix: true },
            });

            expect(gravada.key_hash).not.toContain(chave.key);
            expect(chave.key).toContain(gravada.prefix);
        });

        it('a listagem nunca devolve nada que sirva para usar a chave', async () => {
            await criarChave(dono, serverId);

            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/servers/${serverId}/api-keys`,
                headers: auth(dono),
            });

            expect(response.statusCode, response.body).toBe(200);
            expect(response.body).not.toContain('vh_');
            expect(response.json()[0]).not.toHaveProperty('key');
            expect(response.json()[0]).not.toHaveProperty('keyHash');
        });

        it('só quem manda no servidor cria chaves', async () => {
            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/servers/${serverId}/api-keys`,
                headers: auth(alheio),
                payload: { label: 'minha' },
            });

            expect(response.statusCode, response.body).toBe(403);
        });

        it('não se criam chaves sem sessão', async () => {
            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/servers/${serverId}/api-keys`,
                payload: { label: 'minha' },
            });

            expect(response.statusCode).toBe(401);
        });
    });

    describe('a chave a falar pelo servidor', () => {
        it('diz de que servidor é', async () => {
            const chave = await criarChave(dono, serverId);

            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/ingest/me',
                headers: comChave(chave.key),
            });

            expect(response.statusCode, response.body).toBe(200);
            expect(response.json().serverId).toBe(serverId);
        });

        /**
         * A recusa é sempre a mesma. Dizer *qual* dos casos é dizer a
         * quem tenta o que lhe falta acertar.
         */
        it.each([
            ['inexistente', 'vh_naoexiste_segredoqualquer'],
            ['mal formada', 'isto-nao-e-uma-chave'],
            ['com a marca errada', 'xx_abc_def'],
            ['vazia', ''],
        ])('recusa uma chave %s com 401', async (_nome, apresentada) => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/ingest/me',
                headers: comChave(apresentada),
            });

            expect(response.statusCode).toBe(401);
        });

        it('recusa sem cabeçalho nenhum', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/ingest/me',
            });

            expect(response.statusCode).toBe(401);
        });

        /**
         * O segredo certo com o prefixo de outra chave não entra: a
         * linha é encontrada pelo prefixo, e o resumo é o que decide.
         */
        it('recusa o segredo de uma chave com o prefixo de outra', async () => {
            const primeira = await criarChave(dono, serverId, 'a');
            const segunda = await criarChave(dono, serverId, 'b');

            const segredoDaPrimeira = primeira.key.slice(
                `vh_${primeira.prefix}_`.length,
            );

            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/ingest/me',
                headers: comChave(`vh_${segunda.prefix}_${segredoDaPrimeira}`),
            });

            expect(response.statusCode).toBe(401);
        });

        it('uma chave revogada deixa de servir', async () => {
            const chave = await criarChave(dono, serverId);

            const revogar = await app.inject({
                method: 'DELETE',
                url: `/api/v1/servers/${serverId}/api-keys/${chave.id}`,
                headers: auth(dono),
            });

            expect(revogar.statusCode, revogar.body).toBe(204);

            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/ingest/me',
                headers: comChave(chave.key),
            });

            expect(response.statusCode).toBe(401);
        });

        /**
         * Quem gere um servidor não revoga as chaves de outro. Sem o
         * servidor na procura, bastava conhecer o identificador da
         * chave alheia.
         */
        it('não se revoga a chave de outro servidor', async () => {
            const chave = await criarChave(dono, serverId);

            const response = await app.inject({
                method: 'DELETE',
                url: `/api/v1/servers/${outroServerId}/api-keys/${chave.id}`,
                headers: auth(alheio),
            });

            expect(response.statusCode, response.body).toBe(404);

            const aindaServe = await app.inject({
                method: 'GET',
                url: '/api/v1/ingest/me',
                headers: comChave(chave.key),
            });

            expect(aindaServe.statusCode).toBe(200);
        });

        it('a chave regista quando foi usada', async () => {
            const chave = await criarChave(dono, serverId);

            await app.inject({
                method: 'GET',
                url: '/api/v1/ingest/me',
                headers: comChave(chave.key),
            });

            const gravada = await prisma.serverApiKey.findFirstOrThrow({
                where: { id: chave.id },
                select: { last_used_at: true },
            });

            expect(gravada.last_used_at).not.toBeNull();
        });
    });

    describe('o heartbeat', () => {
        it('põe o servidor online e guarda quantos estão dentro', async () => {
            const chave = await criarChave(dono, serverId);

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/ingest/heartbeat',
                headers: comChave(chave.key),
                payload: { playersOnline: 42 },
            });

            expect(response.statusCode, response.body).toBe(200);

            const perfil = await app.inject({
                method: 'GET',
                url: `/api/v1/servers/${serverId}`,
            });

            expect(perfil.json().isOnline).toBe(true);
            expect(perfil.json().playersOnline).toBe(42);
        });

        /**
         * A partir do primeiro sinal, estar online deixa de ser uma
         * marca que alguém liga à mão e passa a expirar sozinha.
         */
        it('um servidor que deixou de reportar deixa de estar online', async () => {
            const chave = await criarChave(dono, serverId);

            await app.inject({
                method: 'POST',
                url: '/api/v1/ingest/heartbeat',
                headers: comChave(chave.key),
                payload: { playersOnline: 5 },
            });

            /** Recua o relógio para lá da janela. */
            await prisma.server.update({
                where: { id: serverId },
                data: {
                    last_heartbeat_at: new Date(
                        Date.now() - HEARTBEAT_JANELA_MS - 1000,
                    ),
                },
            });

            const perfil = await app.inject({
                method: 'GET',
                url: `/api/v1/servers/${serverId}`,
            });

            expect(perfil.json().isOnline).toBe(false);
        });

        /**
         * A mesma pergunta feita no diretório tem de dar a mesma
         * resposta que no perfil — o filtro vem do mesmo sítio.
         */
        it('o diretório concorda com o perfil, antes e depois de expirar', async () => {
            const chave = await criarChave(dono, serverId);

            await app.inject({
                method: 'POST',
                url: '/api/v1/ingest/heartbeat',
                headers: comChave(chave.key),
                payload: { playersOnline: 7 },
            });

            const noDiretorio = async (): Promise<boolean> => {
                const response = await app.inject({
                    method: 'GET',
                    url: `/api/v1/servers?search=Server ${marca}&onlineOnly=true`,
                });

                expect(response.statusCode, response.body).toBe(200);

                return (response.json().items as { id: string }[]).some(
                    (item) => item.id === serverId,
                );
            };

            expect(await noDiretorio()).toBe(true);

            await prisma.server.update({
                where: { id: serverId },
                data: {
                    last_heartbeat_at: new Date(
                        Date.now() - HEARTBEAT_JANELA_MS - 1000,
                    ),
                },
            });

            expect(await noDiretorio()).toBe(false);
        });

        /**
         * Um servidor que nunca instalou o recurso continua a valer o
         * que o dono marcou: é a única coisa que existe sobre ele.
         */
        it('quem nunca reportou continua a valer a marca do dono', async () => {
            await prisma.server.update({
                where: { id: serverId },
                data: { isOnline: true, last_heartbeat_at: null },
            });

            const perfil = await app.inject({
                method: 'GET',
                url: `/api/v1/servers/${serverId}`,
            });

            expect(perfil.json().isOnline).toBe(true);
            expect(perfil.json().playersOnline).toBeNull();
        });

        it('recusa uma contagem de jogadores absurda', async () => {
            const chave = await criarChave(dono, serverId);

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/ingest/heartbeat',
                headers: comChave(chave.key),
                payload: { playersOnline: 999_999_999 },
            });

            expect(response.statusCode).toBe(400);
        });

        it('não se reporta sem chave', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/ingest/heartbeat',
                payload: { playersOnline: 1 },
            });

            expect(response.statusCode).toBe(401);
        });

        /**
         * Uma chave fala por **um** servidor. O identificador do
         * servidor não vem no corpo de propósito: se viesse, uma chave
         * podia reportar pelo servidor de outra pessoa.
         */
        it('uma chave só reporta pelo servidor dela', async () => {
            const chave = await criarChave(dono, serverId);

            await app.inject({
                method: 'POST',
                url: '/api/v1/ingest/heartbeat',
                headers: comChave(chave.key),
                payload: { playersOnline: 3, serverId: outroServerId },
            });

            const outro = await prisma.server.findFirstOrThrow({
                where: { id: outroServerId },
                select: { last_heartbeat_at: true },
            });

            expect(outro.last_heartbeat_at).toBeNull();
        });
    });
});
