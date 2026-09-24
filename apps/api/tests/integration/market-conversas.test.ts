import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * As conversas sobre um anúncio, contra PostgreSQL a sério.
 *
 * O que aqui se prova não é que duas pessoas conseguem falar — isso
 * seria fácil. É **quem não entra**: uma conversa é de duas pessoas, e
 * a plataforma tem uma promessa escrita na política de privacidade
 * sobre quem a lê. Uma rota a devolver uma conversa a quem não está
 * nela quebra essa promessa sem partir nada.
 *
 * E prova que uma mensagem se denuncia por dentro, e só por dentro:
 * sem isso, bastava adivinhar um identificador para pôr a
 * correspondência de duas pessoas em frente a um moderador.
 */
describe('as conversas do mercado', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let vendedora: { token: string; id: string };
    let compradora: { token: string; id: string };
    let estranha: { token: string; id: string };
    let moderadora: { token: string; id: string };

    let serverId: string;
    let listingId: string;

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
        };
    };

    const abrirConversa = (quem: { token: string }, anuncio = listingId) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/market/listings/${anuncio}/conversations`,
            headers: auth(quem.token),
        });

    const escrever = (
        quem: { token: string },
        conversationId: string,
        body = 'A que horas entregas?',
    ) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/market/conversations/${conversationId}/messages`,
            headers: auth(quem.token),
            payload: { body },
        });

    const ler = (quem: { token: string }, conversationId: string) =>
        app.inject({
            method: 'GET',
            url: `/api/v1/market/conversations/${conversationId}`,
            headers: auth(quem.token),
        });

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        vendedora = await registar(`cv${marca}`);
        compradora = await registar(`cc${marca}`);
        estranha = await registar(`ce${marca}`);
        moderadora = await registar(`cm${marca}`);

        const cargo = await prisma.role.findFirstOrThrow({
            where: { slug: 'moderator' },
            select: { id: true },
        });

        await prisma.userRole.create({
            data: { userId: moderadora.id, roleId: cargo.id },
        });

        const servidor = await app.inject({
            method: 'POST',
            url: '/api/v1/servers',
            headers: auth(vendedora.token),
            payload: { name: `Servidor das conversas ${marca}` },
        });

        expect(servidor.statusCode, servidor.body).toBe(201);
        serverId = servidor.json().id as string;

        const anuncio = await app.inject({
            method: 'POST',
            url: `/api/v1/market/servers/${serverId}/listings`,
            headers: auth(vendedora.token),
            payload: {
                category: 'vehicle',
                title: `Banshee para conversar ${marca}`,
                body: 'Entrego no parque do porto.',
                price: '250000',
            },
        });

        expect(anuncio.statusCode, anuncio.body).toBe(201);
        listingId = anuncio.json().id as string;
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    /**
     * Perguntar por um anúncio não exige jogar no servidor, ao
     * contrário de anunciar: quem está a pensar entrar num servidor
     * pergunta antes de lá estar, e é essa a primeira conversa que
     * alguém tem.
     */
    it('deixa quem lê o anúncio abrir uma conversa', async () => {
        const aberta = await abrirConversa(compradora);

        expect(aberta.statusCode, aberta.body).toBe(201);

        const conversationId = aberta.json().id as string;

        expect((await escrever(compradora, conversationId)).statusCode).toBe(
            201,
        );

        const lida = await ler(vendedora, conversationId);

        expect(lida.statusCode, lida.body).toBe(200);
        expect(lida.json().messages).toHaveLength(1);
        expect(lida.json().messages[0].body).toContain('A que horas');
    });

    /**
     * Dois cliques seguidos no mesmo botão não abrem duas conversas: o
     * índice único é que o garante, e não uma leitura antes da escrita.
     */
    it('não abre uma segunda conversa sobre o mesmo anúncio', async () => {
        const primeira = await abrirConversa(compradora);
        const segunda = await abrirConversa(compradora);

        expect(primeira.json().id).toBe(segunda.json().id);
    });

    it('não deixa falar com o próprio anúncio', async () => {
        const resposta = await abrirConversa(vendedora);

        expect(resposta.statusCode).toBe(409);
        expect(resposta.json().code).toBe('IS_YOURS');
    });

    /**
     * A promessa da política de privacidade, exercitada: quem não está
     * na conversa não a lê. E a recusa é a de uma conversa que não
     * existe — dizer "existe mas não é contigo" já contava que duas
     * pessoas estão a falar sobre aquele anúncio.
     */
    it('não deixa um estranho ler a conversa', async () => {
        const conversationId = (await abrirConversa(compradora)).json()
            .id as string;

        await escrever(compradora, conversationId);

        const lida = await ler(estranha, conversationId);

        expect(lida.statusCode).toBe(404);
        expect(lida.json().code).toBe('CONVERSATION_NOT_FOUND');
    });

    it('nem escrever nela', async () => {
        const conversationId = (await abrirConversa(compradora)).json()
            .id as string;

        const escrita = await escrever(estranha, conversationId, 'Entro eu.');

        expect(escrita.statusCode).toBe(404);
        expect(escrita.json().code).toBe('CONVERSATION_NOT_FOUND');
    });

    /**
     * Nem um moderador. A fila mostra-lhe **a mensagem denunciada**, e
     * é só isso que ele vê: a conversa em si continua a ser das duas
     * pessoas, e nada nesta API lha abre.
     */
    it('nem um moderador, que não é parte nela', async () => {
        const conversationId = (await abrirConversa(compradora)).json()
            .id as string;

        const lida = await ler(moderadora, conversationId);

        expect(lida.statusCode).toBe(404);
    });

    it('não deixa ler sem sessão nenhuma', async () => {
        const conversationId = (await abrirConversa(compradora)).json()
            .id as string;

        const lida = await app.inject({
            method: 'GET',
            url: `/api/v1/market/conversations/${conversationId}`,
        });

        expect(lida.statusCode).toBe(401);
    });

    it('mostra a conversa nas caixas de entrada das duas pessoas', async () => {
        const conversationId = (await abrirConversa(compradora)).json()
            .id as string;

        await escrever(compradora, conversationId, 'Ainda tens isto?');

        for (const quem of [compradora, vendedora]) {
            const caixa = await app.inject({
                method: 'GET',
                url: '/api/v1/market/conversations',
                headers: auth(quem.token),
            });

            expect(caixa.statusCode, caixa.body).toBe(200);

            const minha = (
                caixa.json().conversations as {
                    id: string;
                    ultima: { body: string } | null;
                    comQuem: { username: string } | null;
                }[]
            ).find((conversa) => conversa.id === conversationId);

            expect(minha?.ultima?.body).toBe('Ainda tens isto?');
            expect(minha?.comQuem?.username).not.toBe(undefined);
        }
    });

    /**
     * Quem está na caixa de entrada vê **a outra pessoa**, e não sempre
     * o mesmo nome: uma lista que mostrasse o próprio nome obrigava a
     * abrir cada linha para saber com quem se estava a falar.
     */
    it('e cada uma vê a outra', async () => {
        const conversationId = (await abrirConversa(compradora)).json()
            .id as string;

        await escrever(compradora, conversationId);

        const daCompradora = await app.inject({
            method: 'GET',
            url: '/api/v1/market/conversations',
            headers: auth(compradora.token),
        });

        const daVendedora = await app.inject({
            method: 'GET',
            url: '/api/v1/market/conversations',
            headers: auth(vendedora.token),
        });

        const achar = (resposta: { json: () => unknown }) =>
            (
                (resposta.json() as {
                    conversations: {
                        id: string;
                        comQuem: { username: string } | null;
                    }[];
                }).conversations
            ).find((conversa) => conversa.id === conversationId);

        expect(achar(daCompradora)?.comQuem?.username).toContain('cv');
        expect(achar(daVendedora)?.comQuem?.username).toContain('cc');
    });

    it('não deixa escrever num anúncio já retirado', async () => {
        const anuncio = await app.inject({
            method: 'POST',
            url: `/api/v1/market/servers/${serverId}/listings`,
            headers: auth(vendedora.token),
            payload: {
                category: 'item',
                title: `Para ser retirado ${marca}`,
                body: 'Uma descrição que chegue.',
                price: '100',
            },
        });

        const outro = anuncio.json().id as string;

        const conversationId = (await abrirConversa(compradora, outro)).json()
            .id as string;

        await app.inject({
            method: 'DELETE',
            url: `/api/v1/market/listings/${outro}`,
            headers: auth(vendedora.token),
        });

        const escrita = await escrever(compradora, conversationId);

        expect(escrita.statusCode).toBe(404);
        expect(escrita.json().code).toBe('LISTING_NOT_FOUND');
    });

    describe('denunciar uma mensagem', () => {
        /**
         * Procura na fila da última página para trás.
         *
         * A fila é ordenada pelas mais velhas primeiro, por isso o que
         * este teste acabou de criar está no fim — mas as outras
         * suites correm contra a mesma base de dados e vão empurrando
         * denúncias para o meio, e ler só a última página passava
         * sozinho e falhava na suite inteira.
         */
        const PAGINAS_A_PROCURAR = 5;

        const naFilaDoModerador = async (
            condicao: (denuncia: {
                target: { kind: string; openId: string; body: string | null };
            }) => boolean,
        ) => {
            const primeira = await app.inject({
                method: 'GET',
                url: '/api/v1/moderation/reports',
                headers: auth(moderadora.token),
            });

            expect(primeira.statusCode, primeira.body).toBe(200);

            const paginas = primeira.json().pages as number;

            for (
                let pagina = paginas;
                pagina > 0 && pagina > paginas - PAGINAS_A_PROCURAR;
                pagina -= 1
            ) {
                const lida = await app.inject({
                    method: 'GET',
                    url: `/api/v1/moderation/reports?page=${pagina}`,
                    headers: auth(moderadora.token),
                });

                const encontrada = (
                    lida.json().reports as {
                        target: {
                            kind: string;
                            openId: string;
                            body: string | null;
                        };
                    }[]
                ).find(condicao);

                if (encontrada !== undefined) {
                    return encontrada;
                }
            }

            return undefined;
        };

        const denunciar = (quem: { token: string }, messageId: string) =>
            app.inject({
                method: 'POST',
                url: `/api/v1/market/messages/${messageId}/reports`,
                headers: auth(quem.token),
                payload: { reason: 'abuse' },
            });

        /** Uma frase que só existe nas mensagens à volta da denunciada. */
        const SO_NA_VIZINHANCA = `Uma coisa que ninguém de fora devia ler ${marca}`;

        const conversaComMensagem = async () => {
            const conversationId = (await abrirConversa(compradora)).json()
                .id as string;

            await escrever(compradora, conversationId, SO_NA_VIZINHANCA);

            const escrita = await escrever(
                compradora,
                conversationId,
                'Pago-te por fora, em dinheiro a sério.',
            );

            await escrever(vendedora, conversationId, SO_NA_VIZINHANCA);

            return {
                conversationId,
                messageId: escrita.json().id as string,
            };
        };

        it('deixa a outra pessoa da conversa denunciar', async () => {
            const { messageId } = await conversaComMensagem();

            const resposta = await denunciar(vendedora, messageId);

            expect(resposta.statusCode, resposta.body).toBe(201);
        });

        /**
         * A recusa a quem não está na conversa é a mesma de uma
         * mensagem que não existe. Qualquer outra resposta contava a um
         * estranho que aquela mensagem é real.
         */
        it('não deixa um estranho denunciar o que não pode ler', async () => {
            const { messageId } = await conversaComMensagem();

            const resposta = await denunciar(estranha, messageId);

            expect(resposta.statusCode).toBe(404);
            expect(resposta.json().code).toBe('TARGET_NOT_FOUND');
        });

        it('nem um moderador, que também não está lá', async () => {
            const { messageId } = await conversaComMensagem();

            const resposta = await denunciar(moderadora, messageId);

            expect(resposta.statusCode).toBe(404);
        });

        it('não deixa denunciar a própria mensagem', async () => {
            const { messageId } = await conversaComMensagem();

            const resposta = await denunciar(compradora, messageId);

            expect(resposta.statusCode).toBe(409);
            expect(resposta.json().code).toBe('IS_YOURS');
        });

        /**
         * O que o moderador vê é **a mensagem**, e não a conversa. É a
         * frase da política de privacidade, exercitada.
         */
        it('põe a mensagem na fila, e só a mensagem', async () => {
            const { conversationId, messageId } = await conversaComMensagem();

            await denunciar(vendedora, messageId);

            const naFila = await naFilaDoModerador(
                (denuncia) => denuncia.target.openId === conversationId,
            );

            expect(naFila?.target.body).toContain('por fora');
            /** O que se abre é a conversa; o que se lê é a mensagem. */
            expect(naFila?.target.openId).toBe(conversationId);

            /**
             * E **nada mais**. A conversa tem outras duas mensagens com
             * uma frase que só existe lá; se alguma delas aparecer na
             * resposta da fila, a promessa da política de privacidade
             * deixou de ser verdade.
             */
            expect(JSON.stringify(naFila)).not.toContain(SO_NA_VIZINHANCA);
        });

        it('deixa quem modera retirar a mensagem', async () => {
            const { conversationId, messageId } = await conversaComMensagem();

            await denunciar(vendedora, messageId);

            const retirada = await app.inject({
                method: 'DELETE',
                url: `/api/v1/market/messages/${messageId}`,
                headers: auth(moderadora.token),
            });

            expect(retirada.statusCode, retirada.body).toBe(204);

            const lida = await ler(compradora, conversationId);

            expect(
                (lida.json().messages as { id: string }[]).some(
                    (mensagem) => mensagem.id === messageId,
                ),
            ).toBe(false);
        });

        it('e quem a escreveu também', async () => {
            const { messageId } = await conversaComMensagem();

            const retirada = await app.inject({
                method: 'DELETE',
                url: `/api/v1/market/messages/${messageId}`,
                headers: auth(compradora.token),
            });

            expect(retirada.statusCode, retirada.body).toBe(204);
        });

        it('mas a outra pessoa da conversa não', async () => {
            const { messageId } = await conversaComMensagem();

            const retirada = await app.inject({
                method: 'DELETE',
                url: `/api/v1/market/messages/${messageId}`,
                headers: auth(vendedora.token),
            });

            expect(retirada.statusCode).toBe(403);
            expect(retirada.json().code).toBe('NOT_YOURS');
        });
    });
});
