import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { CORPO_MINIMO, TITULO_MINIMO, prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * O fórum, contra PostgreSQL a sério.
 *
 * É o primeiro sítio da plataforma onde o público escreve texto que
 * outras pessoas leem, e é isso que decide o que aqui se verifica: quem
 * pode escrever, quem pode retirar o que está escrito, e o que acontece
 * ao texto de alguém que apaga a conta.
 */
describe('o fórum', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let ana: { token: string; id: string; nome: string };
    let bruno: { token: string; id: string; nome: string };
    let moderador: { token: string; id: string; nome: string };

    const registar = async (nome: string) => {
        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: `${nome}@vicehub.test`,
                username: nome,
                password: 'Sup3rS3cret!Pass',
            },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return {
            token: resposta.json().accessToken as string,
            id: resposta.json().user.id as string,
            nome,
        };
    };

    const abrir = async (
        quem: { token: string },
        titulo = `Como divido os ganhos de um assalto ${marca}?`,
        corpo = 'Somos cinco e o líder quer levar mais. Como se faz isso aqui?',
    ) => {
        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/forum/topics',
            headers: auth(quem.token),
            payload: { title: titulo, body: corpo },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return resposta.json().id as string;
    };

    const responder = async (
        quem: { token: string },
        topicId: string,
        corpo = 'Confirmas as presenças e depois divides por participação.',
    ) => {
        const resposta = await app.inject({
            method: 'POST',
            url: `/api/v1/forum/topics/${topicId}/replies`,
            headers: auth(quem.token),
            payload: { body: corpo },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return resposta.json().id as string;
    };

    const ler = async (topicId: string) => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/forum/topics/${topicId}`,
        });

        expect(resposta.statusCode, resposta.body).toBe(200);

        return resposta.json() as {
            title: string;
            body: string | null;
            author: { username: string } | null;
            replies: { id: string; body: string | null }[];
        };
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        ana = await registar(`fa${marca}`);
        bruno = await registar(`fb${marca}`);
        moderador = await registar(`fm${marca}`);

        /**
         * O cargo de moderador não se alcança pela API, tal como o de
         * administrador: dá-se pela base de dados. É o que este teste
         * precisa de exercitar, e é assim que se dá na vida real.
         */
        const cargo = await prisma.role.findFirstOrThrow({
            where: { slug: 'moderator' },
            select: { id: true },
        });

        await prisma.userRole.create({
            data: { userId: moderador.id, roleId: cargo.id },
        });
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    /**
     * Ler não pede sessão, e é a decisão que faz o fórum valer a pena:
     * uma pergunta respondida serve sobretudo quem chega de uma pesquisa
     * sem conta nenhuma.
     */
    it('deixa ler sem sessão', async () => {
        const topicId = await abrir(ana);

        const semSessao = await app.inject({
            method: 'GET',
            url: `/api/v1/forum/topics/${topicId}`,
        });

        expect(semSessao.statusCode).toBe(200);
        expect(semSessao.json().title).toContain('Como divido');

        const lista = await app.inject({
            method: 'GET',
            url: '/api/v1/forum/topics',
        });

        expect(lista.statusCode).toBe(200);
        expect(lista.json().total).toBeGreaterThan(0);
    });

    it('não deixa escrever sem sessão', async () => {
        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/forum/topics',
            payload: { title: 'Uma pergunta qualquer', body: 'Com corpo suficiente.' },
        });

        expect(resposta.statusCode).toBe(401);
    });

    it('guarda a pergunta e quem a fez', async () => {
        const topicId = await abrir(ana);
        const topico = await ler(topicId);

        expect(topico.author?.username).toBe(ana.nome);
        expect(topico.body).toContain('Somos cinco');
    });

    it('deixa outra pessoa responder', async () => {
        const topicId = await abrir(ana);
        await responder(bruno, topicId);

        const topico = await ler(topicId);

        expect(topico.replies).toHaveLength(1);
        expect(topico.replies[0]?.body).toContain('Confirmas as presenças');
    });

    /**
     * Retirar o que se escreveu é o caso mais comum de todos, e uma
     * pessoa espera poder fazê-lo sem pedir a ninguém.
     */
    it('deixa cada pessoa retirar o que escreveu', async () => {
        const topicId = await abrir(ana);

        const resposta = await app.inject({
            method: 'DELETE',
            url: `/api/v1/forum/topics/${topicId}`,
            headers: auth(ana.token),
        });

        expect(resposta.statusCode, resposta.body).toBe(204);

        const depois = await app.inject({
            method: 'GET',
            url: `/api/v1/forum/topics/${topicId}`,
        });

        expect(depois.statusCode).toBe(404);
    });

    /** E não deixa retirar o que é de outra pessoa. */
    it('não deixa ninguém retirar o que não escreveu', async () => {
        const topicId = await abrir(ana);

        const resposta = await app.inject({
            method: 'DELETE',
            url: `/api/v1/forum/topics/${topicId}`,
            headers: auth(bruno.token),
        });

        expect(resposta.statusCode).toBe(403);
        expect(resposta.json().code).toBe('NOT_YOURS');
    });

    /**
     * Menos quem modera. É a razão de a permissão existir, e o caso que
     * separa um fórum de um mural.
     */
    it('deixa quem modera retirar o que é de outra pessoa', async () => {
        const topicId = await abrir(ana);

        const resposta = await app.inject({
            method: 'DELETE',
            url: `/api/v1/forum/topics/${topicId}`,
            headers: auth(moderador.token),
        });

        expect(resposta.statusCode, resposta.body).toBe(204);
    });

    it('deixa quem modera retirar uma resposta de outra pessoa', async () => {
        const topicId = await abrir(ana);
        const replyId = await responder(bruno, topicId);

        const resposta = await app.inject({
            method: 'DELETE',
            url: `/api/v1/forum/replies/${replyId}`,
            headers: auth(moderador.token),
        });

        expect(resposta.statusCode, resposta.body).toBe(204);

        const topico = await ler(topicId);

        expect(topico.replies).toHaveLength(0);
    });

    /**
     * Retirar o tópico não apaga as respostas de outras pessoas da base
     * de dados: fica marcado, e o registo de que houve ali uma pergunta
     * é o que permite a um moderador explicar-se mais tarde.
     */
    it('retira sem apagar o que lá estava', async () => {
        const topicId = await abrir(ana);
        await responder(bruno, topicId);

        await app.inject({
            method: 'DELETE',
            url: `/api/v1/forum/topics/${topicId}`,
            headers: auth(moderador.token),
        });

        const linha = await prisma.forumTopic.findUniqueOrThrow({
            where: { id: topicId },
            select: { is_deleted: true, title: true },
        });

        expect(linha.is_deleted).toBe(true);
        expect(linha.title).toContain('Como divido');
    });

    describe('o que se escreve', () => {
        it.each([
            ['título curto de mais', { title: 'Ajuda', body: 'Um corpo com tamanho suficiente.' }],
            ['corpo curto de mais', { title: 'Uma pergunta como deve ser', body: 'ajuda' }],
            ['título só com espaços', { title: '            ', body: 'Um corpo com tamanho suficiente.' }],
            ['corpo só com quebras', { title: 'Uma pergunta como deve ser', body: '\n\n\n\n\n\n\n\n\n\n\n\n\n\n' }],
        ])('recusa %s', async (_nome, payload) => {
            const resposta = await app.inject({
                method: 'POST',
                url: '/api/v1/forum/topics',
                headers: auth(ana.token),
                payload,
            });

            expect(resposta.statusCode, resposta.body).toBe(400);
        });

        /**
         * O texto é medido **depois** de arrumado. Sem isso, quebras de
         * linha a mais passavam o mínimo: contava-se o que não se ia
         * guardar.
         */
        it('mede o texto depois de o arrumar, e não antes', async () => {
            const comEnchimento = `ajuda${'\n'.repeat(40)}`;

            expect(comEnchimento.length).toBeGreaterThan(CORPO_MINIMO);

            const resposta = await app.inject({
                method: 'POST',
                url: '/api/v1/forum/topics',
                headers: auth(ana.token),
                payload: {
                    title: `Uma pergunta com tamanho ${marca}`,
                    body: comEnchimento,
                },
            });

            expect(resposta.statusCode, resposta.body).toBe(400);
        });

        /**
         * E o que a pessoa escreveu fica letra por letra, sinais de
         * maior e de menor incluídos. Alguém a explicar um erro de
         * configuração precisa de os poder escrever, e a segurança está
         * em isto ser mostrado como texto — nunca como HTML.
         */
        it('guarda o texto tal e qual, marcação incluída', async () => {
            const comSinais = 'Tenho <b>isto</b> no ficheiro e dá erro. O que é?';

            const topicId = await abrir(
                ana,
                `Que erro é este no ficheiro ${marca}?`,
                comSinais,
            );

            expect((await ler(topicId)).body).toBe(comSinais);
        });

        it('aceita um título no limite exato', async () => {
            const resposta = await app.inject({
                method: 'POST',
                url: '/api/v1/forum/topics',
                headers: auth(ana.token),
                payload: {
                    title: 'a'.repeat(TITULO_MINIMO),
                    body: 'Um corpo com tamanho suficiente para passar.',
                },
            });

            expect(resposta.statusCode, resposta.body).toBe(201);
        });
    });

    /**
     * Fechar uma conversa, que é a ferramenta mais branda que um
     * moderador tem.
     *
     * A coluna e a recusa existiam desde o princípio, e não havia rota
     * nenhuma para as ligar: o ecrã sabia desenhar "fechada a respostas
     * novas" e nunca podia mostrá-lo. Isto é o interruptor que faltava.
     */
    describe('fechar e reabrir uma pergunta', () => {
        const fechar = (quem: { token: string }, topicId: string) =>
            app.inject({
                method: 'POST',
                url: `/api/v1/forum/topics/${topicId}/lock`,
                headers: auth(quem.token),
            });

        const reabrir = (quem: { token: string }, topicId: string) =>
            app.inject({
                method: 'DELETE',
                url: `/api/v1/forum/topics/${topicId}/lock`,
                headers: auth(quem.token),
            });

        it('um moderador fecha, e a pergunta deixa de receber respostas', async () => {
            const topicId = await abrir(ana, `Uma conversa que aquece ${marca}`);

            expect((await fechar(moderador, topicId)).statusCode).toBe(204);

            const tentativa = await app.inject({
                method: 'POST',
                url: `/api/v1/forum/topics/${topicId}/replies`,
                headers: auth(bruno.token),
                payload: { body: 'Uma resposta que já não devia entrar.' },
            });

            expect(tentativa.statusCode, tentativa.body).toBe(409);
            expect(tentativa.json().code).toBe('TOPIC_LOCKED');
        });

        /**
         * E o que lá está continua a servir quem chegar depois. É a
         * diferença entre fechar e retirar, e a razão de fechar existir.
         */
        it('deixa a pergunta de pé e à vista de quem não tem sessão', async () => {
            const topicId = await abrir(ana, `Fechada mas legível ${marca}`);

            await responder(bruno, topicId, 'A resposta que resolveu a dúvida.');
            await fechar(moderador, topicId);

            const topico = await ler(topicId);

            expect(topico.replies).toHaveLength(1);
            expect(topico.replies[0]?.body).toBe('A resposta que resolveu a dúvida.');
        });

        it('a leitura passa a dizer que está fechada', async () => {
            const topicId = await abrir(ana, `Diz que está fechada ${marca}`);

            const antes = await app.inject({
                method: 'GET',
                url: `/api/v1/forum/topics/${topicId}`,
            });

            expect(antes.json().isLocked).toBe(false);

            await fechar(moderador, topicId);

            const depois = await app.inject({
                method: 'GET',
                url: `/api/v1/forum/topics/${topicId}`,
            });

            expect(depois.json().isLocked).toBe(true);
        });

        it('reabrir devolve a pergunta às respostas', async () => {
            const topicId = await abrir(ana, `Fechada e reaberta ${marca}`);

            await fechar(moderador, topicId);

            expect((await reabrir(moderador, topicId)).statusCode).toBe(204);

            await responder(bruno, topicId, 'Já pode entrar outra vez.');
        });

        /**
         * Nem sequer a quem escreveu a pergunta.
         *
         * Quem pergunta não é dono da conversa que a resposta dele
         * abriu, e deixar fechar o que é seu dava a qualquer pessoa a
         * maneira de calar quem lhe respondeu.
         */
        it('recusa a quem não modera, incluindo a quem perguntou', async () => {
            const topicId = await abrir(ana, `Não é tua para fechar ${marca}`);

            expect((await fechar(ana, topicId)).statusCode).toBe(403);
            expect((await fechar(bruno, topicId)).statusCode).toBe(403);

            await responder(bruno, topicId, 'E continua a receber respostas.');
        });

        it('responde 404 a uma pergunta que não existe', async () => {
            const resposta = await fechar(
                moderador,
                '00000000-0000-4000-8000-000000000000',
            );

            expect(resposta.statusCode).toBe(404);
            expect(resposta.json().code).toBe('TOPIC_NOT_FOUND');
        });

        /**
         * Dois moderadores a fechar a mesma discussão ao mesmo tempo é o
         * caso normal de uma conversa a aquecer, e não um erro.
         */
        it('fechar duas vezes não é erro', async () => {
            const topicId = await abrir(ana, `Fechada duas vezes ${marca}`);

            expect((await fechar(moderador, topicId)).statusCode).toBe(204);
            expect((await fechar(moderador, topicId)).statusCode).toBe(204);
        });
    });

    /**
     * O ecrã tem de saber que ferramentas mostrar.
     *
     * Sem isto, a moderação existia na API e não tinha interface: não
     * havia botão nenhum, e a única forma de moderar era falar com a API
     * à mão.
     */
    describe('saber quem modera', () => {
        const perguntar = (quem: { token: string }) =>
            app.inject({
                method: 'GET',
                url: '/api/v1/forum/moderation',
                headers: auth(quem.token),
            });

        it('diz que sim a quem modera', async () => {
            const resposta = await perguntar(moderador);

            expect(resposta.statusCode, resposta.body).toBe(200);
            expect(resposta.json().canModerate).toBe(true);
        });

        /**
         * E a quem não modera responde `false`, e não uma recusa: o ecrã
         * tem de poder ler a resposta em vez de tratar um erro.
         */
        it('diz que não a quem não modera, sem recusar o pedido', async () => {
            const resposta = await perguntar(ana);

            expect(resposta.statusCode, resposta.body).toBe(200);
            expect(resposta.json().canModerate).toBe(false);
        });

        it('exige sessão', async () => {
            const resposta = await app.inject({
                method: 'GET',
                url: '/api/v1/forum/moderation',
            });

            expect(resposta.statusCode).toBe(401);
        });
    });

    /**
     * Denunciar, que é o que tira a moderação da sorte.
     *
     * Sem isto, uma publicação só era vista se alguém calhasse de a
     * ler. Quem lê é quem encontra.
     */
    describe('denunciar uma publicação', () => {
        const denunciarTopico = (
            quem: { token: string },
            topicId: string,
            corpo: Record<string, unknown> = { reason: 'spam' },
        ) =>
            app.inject({
                method: 'POST',
                url: `/api/v1/forum/topics/${topicId}/reports`,
                headers: auth(quem.token),
                payload: corpo,
            });

        const denunciarResposta = (
            quem: { token: string },
            replyId: string,
            corpo: Record<string, unknown> = { reason: 'abuse' },
        ) =>
            app.inject({
                method: 'POST',
                url: `/api/v1/forum/replies/${replyId}/reports`,
                headers: auth(quem.token),
                payload: corpo,
            });

        interface Fila {
            reports: {
                id: string;
                reason: string;
                note: string | null;
                reporter: { username: string } | null;
                target: {
                    kind: string;
                    openId: string;
                    title: string | null;
                    body: string | null;
                    isRemoved: boolean;
                };
            }[];
            page: number;
            pages: number;
            total: number;
        }

        const paginaDaFila = async (
            quem: { token: string },
            status: string,
            pagina: number,
        ): Promise<Fila> => {
            const resposta = await app.inject({
                method: 'GET',
                url: `/api/v1/moderation/reports?status=${status}&page=${pagina}`,
                headers: auth(quem.token),
            });

            expect(resposta.statusCode, resposta.body).toBe(200);

            return resposta.json() as Fila;
        };

        /**
         * A última página da fila, que é onde uma denúncia acabada de
         * fazer está.
         *
         * A fila é ordenada da mais velha para a mais nova de propósito,
         * e a base de dados destes testes guarda o que as execuções
         * anteriores lá deixaram. Ler a primeira página e procurar lá a
         * nossa passava enquanto a fila fosse pequena e falhava no dia
         * em que deixasse de ser — que é uma passagem por sorte, e não
         * uma verificação.
         */
        const fila = async (
            quem: { token: string },
            status = 'open',
        ): Promise<Fila> => {
            const primeira = await paginaDaFila(quem, status, 1);

            if (primeira.pages <= 1) {
                return primeira;
            }

            return paginaDaFila(quem, status, primeira.pages);
        };

        /** Quantas estão neste estado, sem depender de página nenhuma. */
        const quantas = async (
            quem: { token: string },
            status = 'open',
        ): Promise<number> => (await paginaDaFila(quem, status, 1)).total;

        it('põe a pergunta denunciada na fila de quem modera', async () => {
            const topicId = await abrir(ana, `Para denunciar ${marca}`);

            const feita = await denunciarTopico(bruno, topicId, {
                reason: 'spam',
                note: 'Isto é publicidade a um servidor.',
            });

            expect(feita.statusCode, feita.body).toBe(201);

            const aberta = await fila(moderador);
            const nossa = aberta.reports.find(
                (denuncia) => denuncia.target.openId === topicId,
            );

            expect(nossa).toBeDefined();
            expect(nossa?.reason).toBe('spam');
            expect(nossa?.note).toBe('Isto é publicidade a um servidor.');
            expect(nossa?.reporter?.username).toBe(bruno.nome);
            expect(nossa?.target.kind).toBe('topic');
        });

        /**
         * E a resposta denunciada leva o tópico dela, que é para onde o
         * moderador vai ler o caso completo.
         */
        it('põe a resposta denunciada na fila, com o caminho para o caso', async () => {
            const topicId = await abrir(ana, `Resposta a denunciar ${marca}`);
            const replyId = await responder(bruno, topicId, 'Uma resposta má.');

            expect((await denunciarResposta(ana, replyId)).statusCode).toBe(201);

            const aberta = await fila(moderador);
            const nossa = aberta.reports.find(
                (denuncia) =>
                    denuncia.target.kind === 'reply'
                    && denuncia.target.openId === topicId,
            );

            expect(nossa).toBeDefined();
            expect(nossa?.target.body).toBe('Uma resposta má.');
        });

        /**
         * A fila é de quem modera, e de mais ninguém: mostra texto que
         * alguém achou mau, com o nome de quem avisou.
         */
        it('recusa a fila a quem não modera', async () => {
            const resposta = await app.inject({
                method: 'GET',
                url: '/api/v1/moderation/reports',
                headers: auth(ana.token),
            });

            expect(resposta.statusCode).toBe(403);
        });

        /**
         * Denunciar o que é nosso não é denúncia: é trabalho posto na
         * fila de outra pessoa. Quem quer o seu texto fora tem o botão
         * de retirar.
         */
        it('recusa denunciar o que é da própria pessoa', async () => {
            const topicId = await abrir(ana, `A minha própria ${marca}`);

            const resposta = await denunciarTopico(ana, topicId);

            expect(resposta.statusCode).toBe(409);
            expect(resposta.json().code).toBe('IS_YOURS');
        });

        /**
         * Uma por pessoa e por publicação, e é a base de dados que o
         * garante — entre a leitura e a escrita cabe um segundo clique.
         */
        it('recusa a segunda denúncia da mesma pessoa à mesma publicação', async () => {
            const topicId = await abrir(ana, `Denunciada duas vezes ${marca}`);

            expect((await denunciarTopico(bruno, topicId)).statusCode).toBe(201);

            const segunda = await denunciarTopico(bruno, topicId);

            expect(segunda.statusCode).toBe(409);
            expect(segunda.json().code).toBe('ALREADY_REPORTED');
        });

        /** Mas outra pessoa pode denunciar a mesma coisa. */
        it('deixa outra pessoa denunciar a mesma publicação', async () => {
            const topicId = await abrir(ana, `Duas pessoas denunciam ${marca}`);
            const outra = await registar(`fo${marca}`);

            expect((await denunciarTopico(bruno, topicId)).statusCode).toBe(201);
            expect((await denunciarTopico(outra, topicId)).statusCode).toBe(201);
        });

        it('recusa denunciar uma publicação que não existe', async () => {
            const resposta = await denunciarTopico(
                bruno,
                '00000000-0000-4000-8000-000000000000',
            );

            expect(resposta.statusCode).toBe(404);
        });

        it('recusa uma razão que não é uma das quatro', async () => {
            const topicId = await abrir(ana, `Razão inventada ${marca}`);

            const resposta = await denunciarTopico(bruno, topicId, {
                reason: 'porque-sim',
            });

            expect(resposta.statusCode).toBe(400);
        });

        /**
         * Fechar uma denúncia é dizer o que se concluiu. As duas
         * conclusões são precisas: "foi visto e está bem" poupa ao
         * moderador seguinte olhar outra vez para a mesma coisa.
         */
        it('tira a denúncia da fila quando o moderador decide', async () => {
            const topicId = await abrir(ana, `Decidida ${marca}`);

            await denunciarTopico(bruno, topicId);

            const abertasAntes = await quantas(moderador);
            const nossa = (await fila(moderador)).reports.find(
                (denuncia) => denuncia.target.openId === topicId,
            );

            expect(nossa).toBeDefined();

            const decisao = await app.inject({
                method: 'POST',
                url: `/api/v1/moderation/reports/${nossa?.id as string}`,
                headers: auth(moderador.token),
                payload: { outcome: 'dismissed' },
            });

            expect(decisao.statusCode, decisao.body).toBe(204);

            /** Uma a menos à espera, e a nossa entre as dispensadas. */
            expect(await quantas(moderador)).toBe(abertasAntes - 1);

            const dispensadas = await fila(moderador, 'dismissed');

            expect(
                dispensadas.reports.some((denuncia) => denuncia.id === nossa?.id),
            ).toBe(true);
        });

        /**
         * A segunda decisão sobre a mesma denúncia é recusada: o
         * segundo moderador estaria a apagar a conclusão do primeiro sem
         * saber que havia uma.
         */
        it('recusa decidir duas vezes a mesma denúncia', async () => {
            const topicId = await abrir(ana, `Decidida duas vezes ${marca}`);

            await denunciarTopico(bruno, topicId);

            const aberta = await fila(moderador);
            const nossa = aberta.reports.find(
                (denuncia) => denuncia.target.openId === topicId,
            );

            const decidir = () =>
                app.inject({
                    method: 'POST',
                    url: `/api/v1/moderation/reports/${nossa?.id as string}`,
                    headers: auth(moderador.token),
                    payload: { outcome: 'acted' },
                });

            expect((await decidir()).statusCode).toBe(204);

            const segunda = await decidir();

            expect(segunda.statusCode).toBe(409);
            expect(segunda.json().code).toBe('REPORT_ALREADY_HANDLED');
        });

        /**
         * Retirar a publicação fecha as denúncias que havia sobre ela.
         *
         * Quem retirou já agiu. Deixá-las abertas mandava o moderador
         * seguinte olhar para texto que já não existe.
         */
        it('fecha as denúncias sozinhas quando a publicação é retirada', async () => {
            const topicId = await abrir(ana, `Retirada depois ${marca}`);

            await denunciarTopico(bruno, topicId);

            const abertasAntes = await quantas(moderador);
            const nossa = (await fila(moderador)).reports.find(
                (denuncia) => denuncia.target.openId === topicId,
            );

            expect(nossa).toBeDefined();

            const retirada = await app.inject({
                method: 'DELETE',
                url: `/api/v1/forum/topics/${topicId}`,
                headers: auth(moderador.token),
            });

            expect(retirada.statusCode, retirada.body).toBe(204);

            expect(await quantas(moderador)).toBe(abertasAntes - 1);
        });
    });

    /**
     * A promessa que a plataforma já faz a quem apaga a conta: **o teu
     * texto é apagado**. O que se escreve no fórum é texto seu, e muitas
     * vezes com mais da pessoa lá dentro do que a biografia teve.
     */
    describe('quando alguém apaga a conta', () => {
        it('retira o texto e deixa a conversa de pé', async () => {
            const sai = await registar(`fs${marca}`);

            const topicId = await abrir(
                sai,
                `Uma pergunta de quem vai sair ${marca}`,
                'Isto é uma coisa pessoal que escrevi e não quero deixar cá.',
            );

            await responder(bruno, topicId, 'Uma resposta de outra pessoa.');

            const saida = await app.inject({
                method: 'DELETE',
                url: '/api/v1/users/me',
                headers: auth(sai.token),
                payload: {
                    confirmation: sai.nome,
                    password: 'Sup3rS3cret!Pass',
                },
            });

            expect(saida.statusCode, saida.body).toBe(204);

            const topico = await ler(topicId);

            /* O texto foi-se. */
            expect(topico.body).toBeNull();

            /* O tópico ficou, e a resposta de outra pessoa com ele. */
            expect(topico.title).toContain('quem vai sair');
            expect(topico.replies).toHaveLength(1);
            expect(topico.replies[0]?.body).toBe('Uma resposta de outra pessoa.');
        });
    });
});
