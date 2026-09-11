import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

interface PerfilDeFora {
    id: string;
    username: string;
    email: string | null;
    verified: boolean;
}

interface Fornecedor {
    /** O nome no endereço e no valor gravado da identidade. */
    slug: 'discord' | 'google';
    /** Uma letra para as marcas, para os dois não disputarem nomes. */
    letra: string;
    /** Onde se troca o código pelo token. */
    token: string;
    /** Onde se pergunta quem é o dono do token. */
    perfil: string;
    /** Como o fornecedor escreve o perfil que devolve. */
    corpo: (perfil: PerfilDeFora) => Record<string, unknown>;
}

/**
 * Os dois fornecedores, escritos como o que os distingue.
 *
 * A decisão sobre a conta é a mesma para ambos, e é por isso que a
 * suite corre duas vezes em vez de existir duas vezes: o que se quer
 * garantir é que a regra do email confirmado vale igual venha a
 * identidade de onde vier.
 */
const FORNECEDORES: Fornecedor[] = [
    {
        slug: 'discord',
        letra: 'd',
        token: 'https://discord.com/api/oauth2/token',
        perfil: 'https://discord.com/api/users/@me',
        corpo: (p) => ({
            id: p.id,
            username: p.username,
            email: p.email,
            verified: p.verified,
        }),
    },
    {
        slug: 'google',
        letra: 'g',
        token: 'https://oauth2.googleapis.com/token',
        perfil: 'https://openidconnect.googleapis.com/v1/userinfo',
        corpo: (p) => ({
            sub: p.id,
            name: p.username,
            email: p.email,
            email_verified: p.verified,
        }),
    },
];

/**
 * Entrar por outro sítio, contra PostgreSQL a sério.
 *
 * O fornecedor em si é substituído — o que se quer provar não é HTTP, é
 * a **decisão sobre a conta**: quem entra na que já tinha, quem se liga
 * a uma que existe, e sobretudo quem **não** se liga.
 *
 * Essa última é a razão de este ficheiro existir. O Discord deixa mudar
 * de email sem confirmar, e há contas de Google de domínio próprio onde
 * o endereço nunca foi confirmado; sem exigir a confirmação, registar
 * lá o email de outra pessoa dava entrada na conta dela aqui, com um
 * clique.
 */
describe.each(FORNECEDORES)('entrar com $slug', (fornecedor) => {
    let app: FastifyInstance;

    const marca = `${fornecedor.letra}${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;

    const stateCookie = `vicehub_${fornecedor.slug}_state`;
    const ida = `/api/v1/auth/${fornecedor.slug}`;
    const regresso = `/api/v1/auth/${fornecedor.slug}/callback`;

    /** O utilizador que o fornecedor diz ser o dono do código. */
    let deFora: PerfilDeFora;

    /**
     * Substitui as duas chamadas ao fornecedor: a troca do código e a
     * pergunta "quem és". Tudo o resto continua a passar pela rede real,
     * que nestes testes não é usada.
     *
     * Os endereços são comparados por inteiro e um pedido a qualquer
     * outro sítio rebenta. Um ramo genérico a responder a tudo faria
     * esta suite passar mesmo que o cliente falasse com o sítio errado.
     */
    const fingirFornecedor = () => {
        vi.stubGlobal(
            'fetch',
            vi.fn((url: string) => {
                const endereco = String(url);

                if (endereco === fornecedor.token) {
                    return Promise.resolve(
                        new Response(
                            JSON.stringify({ access_token: 'token-falso' }),
                            { status: 200, headers: { 'content-type': 'application/json' } },
                        ),
                    );
                }

                if (endereco === fornecedor.perfil) {
                    return Promise.resolve(
                        new Response(JSON.stringify(fornecedor.corpo(deFora)), {
                            status: 200,
                            headers: { 'content-type': 'application/json' },
                        }),
                    );
                }

                throw new Error(`pedido inesperado a ${endereco}`);
            }),
        );
    };

    /** Começa a ida e devolve o `state` que o browser guardaria. */
    const comecar = async (): Promise<string> => {
        const resposta = await app.inject({ method: 'GET', url: ida });

        expect(resposta.statusCode, resposta.body).toBe(302);

        const state = resposta.cookies.find(
            (cookie) => cookie.name === stateCookie,
        )?.value as string;

        expect(state).toBeTruthy();

        return state;
    };

    /**
     * Percorre a ida e o regresso como um browser faria, incluindo o
     * cookie do `state` — que é precisamente o que liga os dois.
     */
    const entrar = async (query = 'code=codigo-valido') => {
        const state = await comecar();

        return app.inject({
            method: 'GET',
            url: `${regresso}?${query}&state=${encodeURIComponent(state)}`,
            cookies: { [stateCookie]: state },
        });
    };

    /** Quem é o dono da sessão que o regresso abriu. */
    const quemEntrou = async (resposta: { cookies: { name: string; value: string }[] }) => {
        const refresh = resposta.cookies.find(
            (cookie) => cookie.name === 'vicehub_refresh_token',
        )?.value;

        expect(refresh).toBeTruthy();

        const renovado = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/refresh',
            cookies: { vicehub_refresh_token: refresh as string },
        });

        expect(renovado.statusCode, renovado.body).toBe(200);

        return renovado.json().user as { id: string; email: string; username: string };
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    describe('quem nunca cá esteve', () => {
        it('entra e fica com conta, já com o email confirmado', async () => {
            deFora = {
                id: `novo${marca}`,
                username: `Novo ${marca}`,
                email: `novo${marca}@fora.test`,
                verified: true,
            };
            fingirFornecedor();

            const resposta = await entrar();

            expect(resposta.statusCode, resposta.body).toBe(302);

            const utilizador = await quemEntrou(resposta);

            expect(utilizador.email).toBe(`novo${marca}@fora.test`);

            const gravado = await prisma.user.findFirstOrThrow({
                where: { id: utilizador.id },
                select: { email_verified_at: true, credentials: true },
            });

            expect(gravado.email_verified_at).not.toBeNull();
            /** Não há password nenhuma: quem entra por aqui não a tem. */
            expect(gravado.credentials).toBeNull();

            /** E a identidade ficou gravada como sendo deste fornecedor. */
            const identidade = await prisma.userAuthProvider.findFirstOrThrow({
                where: { userId: utilizador.id, provider: fornecedor.slug },
                select: { provider_user_id: true },
            });

            expect(identidade.provider_user_id).toBe(`novo${marca}`);
        });

        /**
         * A segunda entrada reencontra a conta pela identidade. Sem
         * isso, cada entrada criava uma conta nova e o email repetido
         * rebentava à segunda.
         */
        it('a segunda entrada volta à mesma conta', async () => {
            deFora = {
                id: `repete${marca}`,
                username: `Repete ${marca}`,
                email: `repete${marca}@fora.test`,
                verified: true,
            };
            fingirFornecedor();

            const primeira = await quemEntrou(await entrar());
            const segunda = await quemEntrou(await entrar());

            expect(segunda.id).toBe(primeira.id);

            const contas = await prisma.user.count({
                where: { email: `repete${marca}@fora.test` },
            });

            expect(contas).toBe(1);
        });

        it('dá outro nome a quem chega com um já ocupado', async () => {
            const nome = `dup${marca}`;

            const registo = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/register',
                payload: {
                    email: `local${marca}@vicehub.test`,
                    username: nome,
                    password: 'Sup3rS3cret!Pass',
                },
            });

            expect(registo.statusCode, registo.body).toBe(201);

            deFora = {
                id: `mesmonome${marca}`,
                username: nome,
                email: `mesmonome${marca}@fora.test`,
                verified: true,
            };
            fingirFornecedor();

            const utilizador = await quemEntrou(await entrar());

            expect(utilizador.username).not.toBe(nome);
            expect(utilizador.username.startsWith(nome)).toBe(true);
        });
    });

    describe('quem já tem conta com esse email', () => {
        it('liga a identidade à conta que já existe, sem abrir outra', async () => {
            const email = `liga${marca}@vicehub.test`;

            const registo = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/register',
                payload: {
                    email,
                    username: `liga${marca}`,
                    password: 'Sup3rS3cret!Pass',
                },
            });

            expect(registo.statusCode, registo.body).toBe(201);

            deFora = {
                id: `ligado${marca}`,
                username: `Ligado ${marca}`,
                email,
                verified: true,
            };
            fingirFornecedor();

            const utilizador = await quemEntrou(await entrar());

            expect(utilizador.email).toBe(email);

            const contas = await prisma.user.count({ where: { email } });

            expect(contas).toBe(1);

            const identidades = await prisma.userAuthProvider.count({
                where: { userId: utilizador.id },
            });

            /** A local, do registo, e a de fora agora. */
            expect(identidades).toBe(2);
        });

        /**
         * **O caso que dá razão a esta regra toda.** Sem ele, tomar a
         * conta de alguém era pôr o email dessa pessoa numa conta nova
         * lá do fornecedor.
         */
        it('recusa ligar-se quando o fornecedor não confirmou o email', async () => {
            const email = `vitima${marca}@vicehub.test`;

            await app.inject({
                method: 'POST',
                url: '/api/v1/auth/register',
                payload: {
                    email,
                    username: `vitima${marca}`,
                    password: 'Sup3rS3cret!Pass',
                },
            });

            deFora = {
                id: `atacante${marca}`,
                username: `Atacante ${marca}`,
                email,
                verified: false,
            };
            fingirFornecedor();

            const resposta = await entrar('code=x');

            expect(resposta.statusCode, resposta.body).toBe(409);
            expect(resposta.json().code).toBe('FEDERATED_EMAIL_UNUSABLE');

            /** E nada ficou ligado à conta da vítima. */
            const identidades = await prisma.userAuthProvider.count({
                where: { user: { email }, provider: fornecedor.slug },
            });

            expect(identidades).toBe(0);
        });
    });

    describe('o state', () => {
        /**
         * Sem esta verificação, mandar a alguém um endereço de regresso
         * com o código de outra pessoa deixava-a a usar a plataforma na
         * conta dela sem dar por isso.
         */
        it('recusa um regresso sem cookie de state', async () => {
            deFora = {
                id: `state${marca}`,
                username: `State ${marca}`,
                email: `state${marca}@fora.test`,
                verified: true,
            };
            fingirFornecedor();

            const resposta = await app.inject({
                method: 'GET',
                url: `${regresso}?code=x&state=inventado`,
            });

            expect(resposta.statusCode).toBe(400);
            expect(resposta.json().code).toBe('FEDERATED_STATE_MISMATCH');
        });

        it('recusa um regresso com um state que não é o nosso', async () => {
            deFora = {
                id: `state2${marca}`,
                username: `State2 ${marca}`,
                email: `state2${marca}@fora.test`,
                verified: true,
            };
            fingirFornecedor();

            const state = await comecar();

            const resposta = await app.inject({
                method: 'GET',
                url: `${regresso}?code=x&state=outro-qualquer`,
                cookies: { [stateCookie]: state },
            });

            expect(resposta.statusCode).toBe(400);
        });

        /**
         * Cada fornecedor tem o seu cookie. Com um partilhado, começar a
         * entrada por um numa aba e pelo outro noutra fazia a segunda
         * ida apagar o `state` da primeira, e quem voltasse pela
         * primeira era recusado sem perceber porquê.
         */
        it('não aceita o state guardado pelo outro fornecedor', async () => {
            const outro = FORNECEDORES.find(
                (candidato) => candidato.slug !== fornecedor.slug,
            ) as Fornecedor;

            const doOutro = await app.inject({
                method: 'GET',
                url: `/api/v1/auth/${outro.slug}`,
            });

            const state = doOutro.cookies.find(
                (cookie) => cookie.name === `vicehub_${outro.slug}_state`,
            )?.value as string;

            expect(state).toBeTruthy();

            const resposta = await app.inject({
                method: 'GET',
                url: `${regresso}?code=x&state=${encodeURIComponent(state)}`,
                cookies: { [`vicehub_${outro.slug}_state`]: state },
            });

            expect(resposta.statusCode).toBe(400);
            expect(resposta.json().code).toBe('FEDERATED_STATE_MISMATCH');
        });
    });

    describe('quem desiste', () => {
        /**
         * Carregar em "cancelar" não é uma avaria: é uma decisão, e o
         * que se faz é levar a pessoa de volta.
         */
        it('volta para a entrada sem erro nenhum', async () => {
            const resposta = await app.inject({
                method: 'GET',
                url: `${regresso}?error=access_denied`,
            });

            expect(resposta.statusCode).toBe(302);
            expect(resposta.headers.location).toContain('/entrar');
        });
    });
});

/**
 * O que o ecrã de entrada lê para saber que botões mostrar.
 *
 * Um botão que leva a um erro é pior do que botão nenhum, e é esta rota
 * que impede que apareça onde não funciona.
 */
describe('as formas de entrar anunciadas', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('diz quais estão configuradas, sem exigir sessão', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: '/api/v1/auth/providers',
        });

        expect(resposta.statusCode, resposta.body).toBe(200);
        expect(resposta.json()).toEqual({ discord: true, google: true });
    });
});
