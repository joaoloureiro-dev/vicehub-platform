import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';
import { tirarPlano } from '../helpers/plans.fixtures.js';

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

    /**
     * O limite de crews do plano do servidor, contra a base de dados a
     * sério.
     *
     * A parte que só aqui se prova é a contagem: quantas crews jogam
     * mesmo lá é uma pergunta à tabela, e um filtro errado — contar os
     * pedidos por responder, contar as que já saíram — passa
     * despercebido com duplos e fecha a porta a quem tinha lugar.
     */
    describe('o limite de crews do plano do servidor', () => {
        /** Um servidor só deste bloco, para as contagens não se cruzarem. */
        let cheio: string;
        let donoCheio: string;

        /** Põe uma crew nova a jogar no servidor, e devolve o id dela. */
        const filiar = async (sufixo: string): Promise<string> => {
            const outroLider = await register(`lim${sufixo}${marca}`);
            const crew = await criarCrew(outroLider, `lim${sufixo}${marca}`);

            const pedido = await pedir(outroLider, crew, cheio);

            expect(pedido.statusCode, pedido.body).toBe(201);

            const aceite = await aceitar(donoCheio, cheio, crew);

            expect(aceite.statusCode, aceite.body).toBe(200);

            return crew;
        };

        const folga = async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/servers/${cheio}/affiliations/allowance`,
                headers: auth(donoCheio),
            });

            expect(response.statusCode, response.body).toBe(200);

            return response.json() as {
                used: number;
                limit: number | null;
                canAcceptMore: boolean;
            };
        };

        beforeAll(async () => {
            donoCheio = await register(`limdono${marca}`);
            cheio = await criarServidor(donoCheio, `lim${marca}`);

            /**
             * Um servidor novo vem com trinta dias de avaliação, e a
             * avaliação vale pelo escalão de entrada — dez crews. O que
             * este bloco prova é o limite de **quem não paga**, por isso
             * a avaliação sai de propósito.
             */
            await tirarPlano({ serverId: cheio });
        });

        it('começa vazio, com as três de quem não paga', async () => {
            expect(await folga()).toEqual({
                used: 0,
                limit: 3,
                canAcceptMore: true,
            });
        });

        it('conta as crews à medida que entram', async () => {
            await filiar('a');
            await filiar('b');

            expect(await folga()).toEqual({
                used: 2,
                limit: 3,
                canAcceptMore: true,
            });
        });

        /**
         * Um pedido por responder não ocupa lugar. Se ocupasse, bastava
         * a alguém candidatar-se para o servidor deixar de poder
         * aceitar seja quem for.
         */
        it('um pedido por responder não ocupa lugar', async () => {
            const outroLider = await register(`limp${marca}`);
            const crew = await criarCrew(outroLider, `limp${marca}`);

            expect((await pedir(outroLider, crew, cheio)).statusCode).toBe(201);

            expect(await folga()).toMatchObject({ used: 2 });
        });

        /**
         * O 402 é a resposta certa, e é o que a diferencia de um 403:
         * quem pede é o dono do servidor e tem toda a autorização. O que
         * falta é o plano dar para mais uma.
         */
        it('recusa a quarta com 402, e não a grava', async () => {
            await filiar('c');

            expect(await folga()).toEqual({
                used: 3,
                limit: 3,
                canAcceptMore: false,
            });

            const outroLider = await register(`limx${marca}`);
            const crew = await criarCrew(outroLider, `limx${marca}`);

            expect((await pedir(outroLider, crew, cheio)).statusCode).toBe(201);

            const recusada = await aceitar(donoCheio, cheio, crew);

            expect(recusada.statusCode, recusada.body).toBe(402);
            expect(recusada.json().code).toBe('SERVER_CREW_LIMIT_REACHED');

            /** E a crew continua sem servidor. */
            expect((await estadoDaCrew(crew)).server).toBeNull();
        });

        /**
         * Candidatar-se continua livre. Um servidor cheio recebe os
         * pedidos na mesma, e é essa fila à porta que lhe dá razão para
         * subir de escalão — melhor argumento do que um número num ecrã
         * de preços.
         */
        it('mesmo cheio, continua a receber pedidos', async () => {
            const outroLider = await register(`limf${marca}`);
            const crew = await criarCrew(outroLider, `limf${marca}`);

            const pedido = await pedir(outroLider, crew, cheio);

            expect(pedido.statusCode, pedido.body).toBe(201);

            const pendentes = await app.inject({
                method: 'GET',
                url: `/api/v1/servers/${cheio}/affiliations/requests`,
                headers: auth(donoCheio),
            });

            expect(pendentes.statusCode, pendentes.body).toBe(200);
            expect(
                (pendentes.json() as { crewId: string }[]).map((l) => l.crewId),
            ).toContain(crew);
        });

        /**
         * O escalão paga-se e a porta abre. Concedido à mão, que é como
         * um plano é concedido enquanto a cobrança não estiver ligada.
         */
        it('com o escalão de servidor, aceita a quarta', async () => {
            await prisma.subscription.create({
                data: {
                    serverId: cheio,
                    plan: 'server_base',
                    status: 'active',
                    price_cents: 1_499,
                    currency: 'EUR',
                    current_period_start: new Date(),
                    current_period_end: new Date(Date.now() + 30 * 86_400_000),
                },
            });

            expect(await folga()).toMatchObject({
                limit: 10,
                canAcceptMore: true,
            });

            const crew = await filiar('d');

            expect((await estadoDaCrew(crew)).server?.id).toBe(cheio);
        });

        /**
         * O que acontece quando o plano acaba: **nada é retirado**. As
         * crews que já lá jogavam ficam onde estão, e o servidor apenas
         * deixa de poder aceitar mais. Tirar uma crew de um servidor por
         * causa de um pagamento desfazia uma relação que não é da
         * plataforma.
         */
        it('sem plano, guarda as que tem e deixa de aceitar mais', async () => {
            await prisma.subscription.updateMany({
                where: { serverId: cheio },
                data: { status: 'canceled' },
            });

            const depois = await folga();

            expect(depois.used).toBe(4);
            expect(depois.limit).toBe(3);
            expect(depois.canAcceptMore).toBe(false);

            /** As quatro continuam lá. */
            const ativas = await app.inject({
                method: 'GET',
                url: `/api/v1/servers/${cheio}/affiliations`,
            });

            expect(ativas.json()).toHaveLength(4);
        });

        /**
         * O escalão do servidor é o plano que ele paga, e isso não é
         * assunto de quem passa por lá.
         */
        it('não diz a folga a quem não gere o servidor', async () => {
            const estranho = await register(`lime${marca}`);

            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/servers/${cheio}/affiliations/allowance`,
                headers: auth(estranho),
            });

            expect(response.statusCode).toBe(403);

            const semSessao = await app.inject({
                method: 'GET',
                url: `/api/v1/servers/${cheio}/affiliations/allowance`,
            });

            expect(semSessao.statusCode).toBe(401);
        });
    });
});