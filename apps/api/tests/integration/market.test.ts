import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { PRECO_MAXIMO, prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * O mercado de um servidor, contra PostgreSQL a sério.
 *
 * A regra que decide tudo o resto é quem pode anunciar: **só quem joga
 * no servidor**. Sem ela, uma conta feita há dois minutos anunciava nos
 * trezentos servidores da plataforma ao mesmo tempo, e o mercado de
 * cada um deixava de valer alguma coisa a quem lá joga.
 *
 * Jogar lá tem dois caminhos — uma adesão direta ao servidor e uma
 * crew filiada — e os dois são exercitados aqui, porque verificar só um
 * deixava metade das pessoas de fora sem que nada falhasse.
 */
describe('o mercado', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    /** A dona do servidor: joga lá por ser dela. */
    let dona: { token: string; id: string };
    /** Joga lá pela crew, depois de a filiação ser aceite. */
    let membro: { token: string; id: string };
    /** Não joga lá de maneira nenhuma. */
    let estranha: { token: string; id: string };

    let serverId: string;
    let outroServerId: string;

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

    const criarServidor = async (token: string, sufixo: string) => {
        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/servers',
            headers: auth(token),
            payload: { name: `Server ${sufixo}` },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return resposta.json().id as string;
    };

    const anunciar = (
        quem: { token: string },
        servidor: string,
        corpo: Record<string, unknown> = {},
    ) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/market/servers/${servidor}/listings`,
            headers: auth(quem.token),
            payload: {
                category: 'vehicle',
                title: `Banshee 900R ${marca}`,
                body: 'Pouco uso, entrega no parque do porto.',
                price: '250000',
                ...corpo,
            },
        });

    const anunciarOk = async (
        quem: { token: string },
        servidor: string,
        corpo: Record<string, unknown> = {},
    ) => {
        const resposta = await anunciar(quem, servidor, corpo);

        expect(resposta.statusCode, resposta.body).toBe(201);

        return resposta.json().id as string;
    };

    const ler = async (listingId: string) => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/market/listings/${listingId}`,
        });

        expect(resposta.statusCode, resposta.body).toBe(200);

        return resposta.json() as {
            title: string;
            body: string;
            price: string;
            status: string;
            closedAt: string | null;
            category: string;
            imageUrl: string | null;
            serverId: string;
            serverName: string;
            seller: { username: string } | null;
        };
    };

    const listar = async (servidor: string, query = '') => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/market/servers/${servidor}/listings${query}`,
        });

        expect(resposta.statusCode, resposta.body).toBe(200);

        return resposta.json() as {
            listings: { id: string; price: string; status: string }[];
            total: number;
            pages: number;
        };
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        dona = await registar(`md${marca}`);
        membro = await registar(`mm${marca}`);
        estranha = await registar(`me${marca}`);

        serverId = await criarServidor(dona.token, `Mercado ${marca}`);
        outroServerId = await criarServidor(estranha.token, `Outro ${marca}`);

        /**
         * A crew do membro pede filiação e a dona aceita. É o segundo
         * caminho para "joga neste servidor", e o mais comum de todos:
         * quase ninguém é dono do servidor onde joga.
         */
        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(membro.token),
            payload: {
                name: `Crew ${marca}`,
                tag: `M${marca.slice(-3)}`,
            },
        });

        expect(crew.statusCode, crew.body).toBe(201);

        const crewId = crew.json().id as string;

        const pedido = await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/affiliation`,
            headers: auth(membro.token),
            payload: { serverId },
        });

        expect(pedido.statusCode, pedido.body).toBe(201);

        const aceite = await app.inject({
            method: 'POST',
            url: `/api/v1/servers/${serverId}/affiliations/${crewId}/accept`,
            headers: auth(dona.token),
        });

        expect(aceite.statusCode, aceite.body).toBe(200);
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('deixa ler o mercado sem sessão', async () => {
        const listingId = await anunciarOk(dona, serverId);

        const semSessao = await app.inject({
            method: 'GET',
            url: `/api/v1/market/listings/${listingId}`,
        });

        expect(semSessao.statusCode).toBe(200);
        expect(semSessao.json().title).toContain('Banshee');

        const lista = await listar(serverId);

        expect(lista.total).toBeGreaterThan(0);
    });

    it('não deixa anunciar sem sessão', async () => {
        const resposta = await app.inject({
            method: 'POST',
            url: `/api/v1/market/servers/${serverId}/listings`,
            payload: {
                category: 'vehicle',
                title: `Sem sessão ${marca}`,
                body: 'Isto não devia entrar no mercado de ninguém.',
                price: '1000',
            },
        });

        expect(resposta.statusCode).toBe(401);
    });

    /**
     * A regra toda, num caso: quem não joga lá não anuncia lá. E o
     * servidor existe — o que se recusa é a relação, e não o endereço.
     */
    it('não deixa anunciar num servidor onde não se joga', async () => {
        const resposta = await anunciar(estranha, serverId);

        expect(resposta.statusCode).toBe(403);
        expect(resposta.json().code).toBe('NOT_ON_SERVER');
    });

    it('deixa anunciar quem lá joga pela crew', async () => {
        const listingId = await anunciarOk(membro, serverId, {
            title: `Oficina no porto ${marca}`,
            category: 'business',
        });

        const anuncio = await ler(listingId);

        expect(anuncio.category).toBe('business');
        expect(anuncio.seller?.username).toContain('mm');
    });

    /**
     * Uma crew que se candidatou e ainda não foi aceite **não é uma
     * crew deste servidor**. Sem esta distinção, bastava pedir filiação
     * a trezentos servidores para anunciar em todos eles nessa tarde.
     */
    it('não deixa anunciar por uma filiação ainda por aceitar', async () => {
        const candidata = await registar(`mc${marca}`);

        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(candidata.token),
            payload: {
                name: `Crew candidata ${marca}`,
                tag: `C${marca.slice(-3)}`,
            },
        });

        expect(crew.statusCode, crew.body).toBe(201);

        const pedido = await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crew.json().id as string}/affiliation`,
            headers: auth(candidata.token),
            payload: { serverId },
        });

        expect(pedido.statusCode, pedido.body).toBe(201);

        const resposta = await anunciar(candidata, serverId);

        expect(resposta.statusCode).toBe(403);
        expect(resposta.json().code).toBe('NOT_ON_SERVER');
    });

    it('recusa um servidor que não existe', async () => {
        const resposta = await anunciar(
            dona,
            '00000000-0000-4000-8000-000000000000',
        );

        expect(resposta.statusCode).toBe(404);
        expect(resposta.json().code).toBe('SERVER_NOT_FOUND');
    });

    /**
     * O preço vai e volta como texto.
     *
     * Um número grande em JSON passa por `double` algures no caminho, e
     * um preço de novecentos mil milhões voltava arredondado — o género
     * de erro que ninguém nota até duas pessoas discutirem uma venda.
     */
    it('não arredonda um preço grande', async () => {
        const listingId = await anunciarOk(dona, serverId, {
            title: `Mansão de Vinewood ${marca}`,
            category: 'property',
            price: PRECO_MAXIMO.toString(),
        });

        const anuncio = await ler(listingId);

        expect(anuncio.price).toBe(PRECO_MAXIMO.toString());
    });

    it('recusa um preço acima do tecto', async () => {
        const resposta = await anunciar(dona, serverId, {
            price: (PRECO_MAXIMO + 1n).toString(),
        });

        expect(resposta.statusCode).toBe(400);
    });

    it('recusa um preço que não seja algarismos', async () => {
        for (const preco of ['12.5', '-3', '1 000', '1e6', '']) {
            const resposta = await anunciar(dona, serverId, { price: preco });

            expect(resposta.statusCode, `preço ${preco}`).toBe(400);
        }
    });

    it('deixa quem anunciou mudar o preço, e mais nada', async () => {
        const listingId = await anunciarOk(dona, serverId);

        const mudanca = await app.inject({
            method: 'PATCH',
            url: `/api/v1/market/listings/${listingId}`,
            headers: auth(dona.token),
            payload: { price: '180000' },
        });

        expect(mudanca.statusCode, mudanca.body).toBe(200);

        const anuncio = await ler(listingId);

        expect(anuncio.price).toBe('180000');
        expect(anuncio.title).toContain('Banshee');
        expect(anuncio.body).toContain('Pouco uso');
    });

    it('não deixa mexer no anúncio de outra pessoa', async () => {
        const listingId = await anunciarOk(dona, serverId);

        const mudanca = await app.inject({
            method: 'PATCH',
            url: `/api/v1/market/listings/${listingId}`,
            headers: auth(membro.token),
            payload: { price: '1' },
        });

        expect(mudanca.statusCode).toBe(403);
        expect(mudanca.json().code).toBe('NOT_YOURS');

        const apagar = await app.inject({
            method: 'DELETE',
            url: `/api/v1/market/listings/${listingId}`,
            headers: auth(membro.token),
        });

        expect(apagar.statusCode).toBe(403);
    });

    /**
     * Vendido e retirado são estados diferentes, e é essa diferença que
     * dá a um servidor novo a única ideia que vai ter de quanto valem
     * as coisas: o preço por que saiu.
     */
    it('guarda o preço por que uma coisa saiu', async () => {
        const listingId = await anunciarOk(dona, serverId, {
            title: `Carrinha de obras ${marca}`,
            price: '75000',
        });

        const fecho = await app.inject({
            method: 'POST',
            url: `/api/v1/market/listings/${listingId}/close`,
            headers: auth(dona.token),
            payload: { outcome: 'sold' },
        });

        expect(fecho.statusCode, fecho.body).toBe(200);

        const anuncio = await ler(listingId);

        expect(anuncio.status).toBe('sold');
        expect(anuncio.price).toBe('75000');
        expect(anuncio.closedAt).not.toBeNull();
    });

    it('não deixa mexer num anúncio já fechado', async () => {
        const listingId = await anunciarOk(dona, serverId);

        await app.inject({
            method: 'POST',
            url: `/api/v1/market/listings/${listingId}/close`,
            headers: auth(dona.token),
            payload: { outcome: 'withdrawn' },
        });

        const mudanca = await app.inject({
            method: 'PATCH',
            url: `/api/v1/market/listings/${listingId}`,
            headers: auth(dona.token),
            payload: { price: '1' },
        });

        expect(mudanca.statusCode).toBe(409);
        expect(mudanca.json().code).toBe('ALREADY_CLOSED');

        const outraVez = await app.inject({
            method: 'POST',
            url: `/api/v1/market/listings/${listingId}/close`,
            headers: auth(dona.token),
            payload: { outcome: 'sold' },
        });

        expect(outraVez.statusCode).toBe(409);
    });

    /**
     * Retirar de vez vale mesmo depois de fechado: quem vendeu uma coisa
     * continua a poder tirar do mercado o que escreveu sobre ela.
     */
    it('deixa retirar de vez um anúncio já vendido', async () => {
        const listingId = await anunciarOk(dona, serverId, {
            title: `Barco de pesca ${marca}`,
        });

        await app.inject({
            method: 'POST',
            url: `/api/v1/market/listings/${listingId}/close`,
            headers: auth(dona.token),
            payload: { outcome: 'sold' },
        });

        const apagar = await app.inject({
            method: 'DELETE',
            url: `/api/v1/market/listings/${listingId}`,
            headers: auth(dona.token),
        });

        expect(apagar.statusCode, apagar.body).toBe(204);

        const depois = await app.inject({
            method: 'GET',
            url: `/api/v1/market/listings/${listingId}`,
        });

        expect(depois.statusCode).toBe(404);
    });

    /**
     * Por omissão a lista traz só os abertos: são os que se podem
     * comprar. Os fechados continuam a poder ser pedidos de propósito,
     * porque é neles que está o histórico de preços.
     */
    it('mostra os abertos por omissão e os fechados a pedido', async () => {
        const listingId = await anunciarOk(dona, serverId, {
            title: `Moto de montanha ${marca}`,
            category: 'item',
        });

        const abertosAntes = await listar(serverId);

        expect(
            abertosAntes.listings.some((um) => um.id === listingId),
        ).toBe(true);

        await app.inject({
            method: 'POST',
            url: `/api/v1/market/listings/${listingId}/close`,
            headers: auth(dona.token),
            payload: { outcome: 'sold' },
        });

        const abertosDepois = await listar(serverId);

        expect(
            abertosDepois.listings.some((um) => um.id === listingId),
        ).toBe(false);

        const vendidos = await listar(serverId, '?status=sold');

        expect(vendidos.listings.some((um) => um.id === listingId)).toBe(true);
    });

    it('filtra por categoria', async () => {
        const listingId = await anunciarOk(dona, serverId, {
            title: `Aulas de condução ${marca}`,
            category: 'service',
        });

        const servicos = await listar(serverId, '?category=service');

        expect(servicos.listings.some((um) => um.id === listingId)).toBe(true);

        const veiculos = await listar(serverId, '?category=vehicle');

        expect(veiculos.listings.some((um) => um.id === listingId)).toBe(false);
    });

    /**
     * O mercado de um servidor é dele. Um anúncio posto num não aparece
     * no outro — é a razão de os anúncios terem dono e não serem uma
     * lista só da plataforma inteira.
     */
    it('não mistura o mercado de dois servidores', async () => {
        const listingId = await anunciarOk(dona, serverId, {
            title: `Só deste servidor ${marca}`,
        });

        const outro = await listar(outroServerId);

        expect(outro.listings.some((um) => um.id === listingId)).toBe(false);
    });

    it('recusa a lista de um servidor que não existe', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: '/api/v1/market/servers/00000000-0000-4000-8000-000000000000/listings',
        });

        expect(resposta.statusCode).toBe(404);
        expect(resposta.json().code).toBe('SERVER_NOT_FOUND');
    });
});
