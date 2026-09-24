import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * As avaliações de uma venda, contra PostgreSQL a sério.
 *
 * O que aqui se prova é **o que impede isto de ser um sistema de
 * vinganças**: só avalia quem falou com quem vendeu sobre aquele
 * anúncio, e só depois de o anúncio ter sido marcado como vendido.
 * Sem as duas condições, bastava uma discussão no fórum para alguém ir
 * estragar a média de outra pessoa.
 *
 * E prova a outra metade: quem foi avaliado responde uma vez, e não
 * apaga a nota que recebeu.
 */
describe('as avaliações do mercado', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let vendedora: { token: string; id: string; nome: string };
    let compradora: { token: string; id: string; nome: string };
    let estranha: { token: string; id: string; nome: string };
    let moderadora: { token: string; id: string; nome: string };

    let serverId: string;

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

    const anunciar = async (titulo: string) => {
        const resposta = await app.inject({
            method: 'POST',
            url: `/api/v1/market/servers/${serverId}/listings`,
            headers: auth(vendedora.token),
            payload: {
                category: 'vehicle',
                title: `${titulo} ${marca}`,
                body: 'Entrego no parque do porto.',
                price: '250000',
            },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return resposta.json().id as string;
    };

    const falar = async (quem: { token: string }, listingId: string) => {
        const conversa = await app.inject({
            method: 'POST',
            url: `/api/v1/market/listings/${listingId}/conversations`,
            headers: auth(quem.token),
        });

        expect(conversa.statusCode, conversa.body).toBe(201);

        const conversationId = conversa.json().id as string;

        await app.inject({
            method: 'POST',
            url: `/api/v1/market/conversations/${conversationId}/messages`,
            headers: auth(quem.token),
            payload: { body: 'Fico com isso.' },
        });
    };

    const vender = (listingId: string) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/market/listings/${listingId}/close`,
            headers: auth(vendedora.token),
            payload: { outcome: 'sold' },
        });

    const avaliar = (
        quem: { token: string },
        listingId: string,
        corpo: Record<string, unknown> = {},
    ) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/market/listings/${listingId}/reviews`,
            headers: auth(quem.token),
            payload: { rating: 5, ...corpo },
        });

    /** O caminho inteiro: conversa, venda, avaliação. */
    const negocioFeito = async (titulo: string) => {
        const listingId = await anunciar(titulo);

        await falar(compradora, listingId);
        await vender(listingId);

        return listingId;
    };

    const perfil = async (nome: string) => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/market/people/${nome}/reviews`,
        });

        expect(resposta.statusCode, resposta.body).toBe(200);

        return resposta.json() as {
            reviews: {
                id: string;
                rating: number;
                body: string | null;
                reply: string | null;
                reviewer: { username: string } | null;
                listing: { title: string };
            }[];
            summary: { average: number | null; count: number };
            total: number;
        };
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        vendedora = await registar(`av${marca}`);
        compradora = await registar(`ac${marca}`);
        estranha = await registar(`ae${marca}`);
        moderadora = await registar(`am${marca}`);

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
            payload: { name: `Servidor das avaliações ${marca}` },
        });

        expect(servidor.statusCode, servidor.body).toBe(201);
        serverId = servidor.json().id as string;
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('deixa avaliar uma venda que aconteceu', async () => {
        const listingId = await negocioFeito('Banshee avaliado');

        const resposta = await avaliar(compradora, listingId, {
            rating: 4,
            body: 'Entregou à hora combinada.',
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        const dela = await perfil(vendedora.nome);

        expect(dela.summary.count).toBeGreaterThan(0);
        expect(dela.reviews[0]?.body).toContain('à hora combinada');
    });

    /**
     * A regra que impede isto de ser um sistema de vinganças. Quem
     * nunca falou com quem vendeu não avalia.
     */
    it('não deixa avaliar quem nunca falou sobre o anúncio', async () => {
        const listingId = await negocioFeito('Sem conversa');

        const resposta = await avaliar(estranha, listingId);

        expect(resposta.statusCode).toBe(409);
        expect(resposta.json().code).toBe('NO_DEAL');
    });

    /**
     * Falar sobre **outro** anúncio não chega.
     *
     * A conversa que dá direito a avaliar é a daquele anúncio. Sem
     * isso, quem falasse uma vez com alguém ficava com licença para
     * avaliar tudo o que essa pessoa vendesse — que é o sistema de
     * vinganças outra vez, com um passo a mais.
     */
    it('não deixa avaliar com uma conversa sobre outro anúncio', async () => {
        const conversado = await anunciar('Este foi conversado');

        await falar(compradora, conversado);

        const outro = await anunciar('Este nao foi');

        await vender(outro);

        const resposta = await avaliar(compradora, outro);

        expect(resposta.statusCode).toBe(409);
        expect(resposta.json().code).toBe('NO_DEAL');
    });

    /** E um anúncio que nunca foi vendido não teve negócio nenhum. */
    it('não deixa avaliar um anúncio que não foi vendido', async () => {
        const listingId = await anunciar('Nunca vendido');

        await falar(compradora, listingId);

        const resposta = await avaliar(compradora, listingId);

        expect(resposta.statusCode).toBe(409);
        expect(resposta.json().code).toBe('NOT_SOLD');
    });

    it('nem um que foi retirado em vez de vendido', async () => {
        const listingId = await anunciar('Retirado da venda');

        await falar(compradora, listingId);

        await app.inject({
            method: 'POST',
            url: `/api/v1/market/listings/${listingId}/close`,
            headers: auth(vendedora.token),
            payload: { outcome: 'withdrawn' },
        });

        const resposta = await avaliar(compradora, listingId);

        expect(resposta.statusCode).toBe(409);
        expect(resposta.json().code).toBe('NOT_SOLD');
    });

    it('não deixa avaliar o próprio anúncio', async () => {
        const listingId = await negocioFeito('O meu proprio');

        const resposta = await avaliar(vendedora, listingId);

        expect(resposta.statusCode).toBe(409);
        expect(resposta.json().code).toBe('IS_YOURS');
    });

    it('não deixa avaliar duas vezes a mesma venda', async () => {
        const listingId = await negocioFeito('Duas vezes');

        expect((await avaliar(compradora, listingId)).statusCode).toBe(201);

        const segunda = await avaliar(compradora, listingId);

        expect(segunda.statusCode).toBe(409);
        expect(segunda.json().code).toBe('ALREADY_REVIEWED');
    });

    it('recusa uma nota fora da escala', async () => {
        const listingId = await negocioFeito('Fora da escala');

        for (const rating of [0, 6, -1]) {
            const resposta = await avaliar(compradora, listingId, { rating });

            expect(resposta.statusCode, `nota ${rating}`).toBe(400);
        }
    });

    /**
     * A média é sobre o histórico inteiro, e uma casa decimal chega:
     * `4,3` diz o que há a dizer, `4,27` finge uma precisão que duas
     * avaliações não têm.
     */
    it('faz a média das notas que recebeu', async () => {
        const outra = await registar(`am2${marca}`);

        const servidor = await app.inject({
            method: 'POST',
            url: '/api/v1/servers',
            headers: auth(outra.token),
            payload: { name: `Servidor da media ${marca}` },
        });

        const servidorId = servidor.json().id as string;

        const vendaDe = async (titulo: string, nota: number) => {
            const anuncio = await app.inject({
                method: 'POST',
                url: `/api/v1/market/servers/${servidorId}/listings`,
                headers: auth(outra.token),
                payload: {
                    category: 'item',
                    title: `${titulo} ${marca}`,
                    body: 'Uma descrição que chegue.',
                    price: '1000',
                },
            });

            const listingId = anuncio.json().id as string;

            await falar(compradora, listingId);

            await app.inject({
                method: 'POST',
                url: `/api/v1/market/listings/${listingId}/close`,
                headers: auth(outra.token),
                payload: { outcome: 'sold' },
            });

            const avaliacao = await avaliar(compradora, listingId, {
                rating: nota,
            });

            expect(avaliacao.statusCode, avaliacao.body).toBe(201);
        };

        await vendaDe('Media um', 5);
        await vendaDe('Media dois', 4);
        await vendaDe('Media tres', 4);

        const dela = await perfil(outra.nome);

        expect(dela.summary.count).toBe(3);
        expect(dela.summary.average).toBe(4.3);
    });

    it('não inventa uma média a quem não tem avaliações', async () => {
        const dela = await perfil(estranha.nome);

        expect(dela.summary.count).toBe(0);
        expect(dela.summary.average).toBeNull();
    });

    describe('a resposta de quem foi avaliado', () => {
        const responder = (quem: { token: string }, reviewId: string) =>
            app.inject({
                method: 'POST',
                url: `/api/v1/market/reviews/${reviewId}/reply`,
                headers: auth(quem.token),
                payload: { body: 'Atrasei-me dez minutos, tens razão.' },
            });

        const avaliacaoFeita = async (titulo: string) => {
            const listingId = await negocioFeito(titulo);
            const criada = await avaliar(compradora, listingId, { rating: 2 });

            expect(criada.statusCode, criada.body).toBe(201);

            return criada.json().id as string;
        };

        it('deixa responder uma vez', async () => {
            const reviewId = await avaliacaoFeita('Com resposta');

            expect((await responder(vendedora, reviewId)).statusCode).toBe(200);

            const dela = await perfil(vendedora.nome);
            const minha = dela.reviews.find(
                (avaliacao) => avaliacao.id === reviewId,
            );

            expect(minha?.reply).toContain('dez minutos');
        });

        it('e só uma', async () => {
            const reviewId = await avaliacaoFeita('So uma resposta');

            await responder(vendedora, reviewId);

            const segunda = await responder(vendedora, reviewId);

            expect(segunda.statusCode).toBe(409);
            expect(segunda.json().code).toBe('ALREADY_REPLIED');
        });

        it('não deixa outra pessoa responder', async () => {
            const reviewId = await avaliacaoFeita('Resposta alheia');

            const resposta = await responder(estranha, reviewId);

            expect(resposta.statusCode).toBe(403);
            expect(resposta.json().code).toBe('NOT_YOURS');
        });

        /**
         * A regra que dá valor a uma média: quem foi avaliado **não**
         * apaga a nota que recebeu. Uma média que o dono limpa não diz
         * nada a ninguém.
         */
        it('não deixa quem foi avaliado apagar a avaliação', async () => {
            const reviewId = await avaliacaoFeita('Apagar a minha nota');

            const resposta = await app.inject({
                method: 'DELETE',
                url: `/api/v1/market/reviews/${reviewId}`,
                headers: auth(vendedora.token),
            });

            expect(resposta.statusCode).toBe(403);
            expect(resposta.json().code).toBe('NOT_YOURS');
        });

        it('mas quem a escreveu apaga', async () => {
            const reviewId = await avaliacaoFeita('Apagar a que escrevi');

            const resposta = await app.inject({
                method: 'DELETE',
                url: `/api/v1/market/reviews/${reviewId}`,
                headers: auth(compradora.token),
            });

            expect(resposta.statusCode, resposta.body).toBe(204);
        });

        it('e quem modera também', async () => {
            const reviewId = await avaliacaoFeita('Apagada por quem modera');

            const resposta = await app.inject({
                method: 'DELETE',
                url: `/api/v1/market/reviews/${reviewId}`,
                headers: auth(moderadora.token),
            });

            expect(resposta.statusCode, resposta.body).toBe(204);
        });
    });

    describe('denunciar uma avaliação', () => {
        it('deixa quem foi avaliado denunciar', async () => {
            const listingId = await negocioFeito('Para denunciar');

            const criada = await avaliar(compradora, listingId, {
                rating: 1,
                body: 'Insultos e mais nada.',
            });

            const reviewId = criada.json().id as string;

            const denuncia = await app.inject({
                method: 'POST',
                url: `/api/v1/market/reviews/${reviewId}/reports`,
                headers: auth(vendedora.token),
                payload: { reason: 'abuse' },
            });

            expect(denuncia.statusCode, denuncia.body).toBe(201);
        });

        /**
         * Uma avaliação é pública: qualquer pessoa a lê, e por isso
         * qualquer pessoa a pode denunciar — ao contrário de uma
         * mensagem, que só se denuncia por dentro.
         */
        it('e qualquer pessoa também, porque é pública', async () => {
            const listingId = await negocioFeito('Publica e denunciavel');

            const criada = await avaliar(compradora, listingId, {
                rating: 1,
                body: 'Mais insultos.',
            });

            const denuncia = await app.inject({
                method: 'POST',
                url: `/api/v1/market/reviews/${criada.json().id as string}/reports`,
                headers: auth(estranha.token),
                payload: { reason: 'abuse' },
            });

            expect(denuncia.statusCode, denuncia.body).toBe(201);
        });

        it('não deixa denunciar a própria avaliação', async () => {
            const listingId = await negocioFeito('A minha avaliacao');

            const criada = await avaliar(compradora, listingId);

            const denuncia = await app.inject({
                method: 'POST',
                url: `/api/v1/market/reviews/${criada.json().id as string}/reports`,
                headers: auth(compradora.token),
                payload: { reason: 'other' },
            });

            expect(denuncia.statusCode).toBe(409);
            expect(denuncia.json().code).toBe('IS_YOURS');
        });
    });
});
