import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * Entrar com Discord, contra PostgreSQL a sério.
 *
 * O Discord em si é substituído — o que se quer provar não é HTTP, é a
 * **decisão sobre a conta**: quem entra na que já tinha, quem se liga a
 * uma que existe, e sobretudo quem **não** se liga.
 *
 * Essa última é a razão de este ficheiro existir. O Discord deixa mudar
 * de email sem confirmar; sem exigir a confirmação, registar lá o email
 * de outra pessoa dava entrada na conta dela aqui, com um clique.
 */
describe('entrar com Discord', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;

    /** O utilizador que o Discord diz ser o dono do código. */
    let doDiscord: {
        id: string;
        username: string;
        email: string | null;
        verified: boolean;
    };

    /**
     * Substitui as duas chamadas ao Discord: a troca do código e a
     * pergunta "quem és". Tudo o resto continua a passar pela rede real,
     * que nestes testes não é usada.
     */
    const fingirDiscord = () => {
        vi.stubGlobal(
            'fetch',
            vi.fn((url: string) => {
                const endereco = String(url);

                if (endereco.includes('/oauth2/token')) {
                    return Promise.resolve(
                        new Response(
                            JSON.stringify({ access_token: 'token-falso' }),
                            { status: 200, headers: { 'content-type': 'application/json' } },
                        ),
                    );
                }

                if (endereco.includes('/users/@me')) {
                    return Promise.resolve(
                        new Response(JSON.stringify(doDiscord), {
                            status: 200,
                            headers: { 'content-type': 'application/json' },
                        }),
                    );
                }

                return Promise.resolve(new Response('', { status: 404 }));
            }),
        );
    };

    /**
     * Percorre a ida e o regresso como um browser faria, incluindo o
     * cookie do `state` — que é precisamente o que liga os dois.
     */
    const entrar = async (query = 'code=codigo-valido') => {
        const ida = await app.inject({
            method: 'GET',
            url: '/api/v1/auth/discord',
        });

        expect(ida.statusCode, ida.body).toBe(302);

        const state = ida.cookies.find(
            (cookie) => cookie.name === 'vicehub_discord_state',
        )?.value as string;

        expect(state).toBeTruthy();

        return app.inject({
            method: 'GET',
            url: `/api/v1/auth/discord/callback?${query}&state=${encodeURIComponent(state)}`,
            cookies: { vicehub_discord_state: state },
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
            doDiscord = {
                id: `novo${marca}`,
                username: `Novo ${marca}`,
                email: `novo${marca}@discord.test`,
                verified: true,
            };
            fingirDiscord();

            const resposta = await entrar();

            expect(resposta.statusCode, resposta.body).toBe(302);

            const utilizador = await quemEntrou(resposta);

            expect(utilizador.email).toBe(`novo${marca}@discord.test`);

            const gravado = await prisma.user.findFirstOrThrow({
                where: { id: utilizador.id },
                select: { email_verified_at: true, credentials: true },
            });

            expect(gravado.email_verified_at).not.toBeNull();
            /** Não há password nenhuma: quem entra pelo Discord não a tem. */
            expect(gravado.credentials).toBeNull();
        });

        /**
         * A segunda entrada reencontra a conta pela identidade. Sem
         * isso, cada entrada criava uma conta nova e o email repetido
         * rebentava à segunda.
         */
        it('a segunda entrada volta à mesma conta', async () => {
            doDiscord = {
                id: `repete${marca}`,
                username: `Repete ${marca}`,
                email: `repete${marca}@discord.test`,
                verified: true,
            };
            fingirDiscord();

            const primeira = await quemEntrou(await entrar());
            const segunda = await quemEntrou(await entrar());

            expect(segunda.id).toBe(primeira.id);

            const contas = await prisma.user.count({
                where: { email: `repete${marca}@discord.test` },
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

            doDiscord = {
                id: `mesmonome${marca}`,
                username: nome,
                email: `mesmonome${marca}@discord.test`,
                verified: true,
            };
            fingirDiscord();

            const utilizador = await quemEntrou(await entrar());

            expect(utilizador.username).not.toBe(nome);
            expect(utilizador.username.startsWith(nome)).toBe(true);
        });
    });

    describe('quem já tem conta com esse email', () => {
        it('liga o Discord à conta que já existe, sem abrir outra', async () => {
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

            doDiscord = {
                id: `ligado${marca}`,
                username: `Ligado ${marca}`,
                email,
                verified: true,
            };
            fingirDiscord();

            const utilizador = await quemEntrou(await entrar());

            expect(utilizador.email).toBe(email);

            const contas = await prisma.user.count({ where: { email } });

            expect(contas).toBe(1);

            const identidades = await prisma.userAuthProvider.count({
                where: { userId: utilizador.id },
            });

            /** A local, do registo, e a do Discord agora. */
            expect(identidades).toBe(2);
        });

        /**
         * **O caso que dá razão a esta regra toda.** Sem ele, tomar a
         * conta de alguém era pôr o email dessa pessoa num Discord novo.
         */
        it('recusa ligar-se quando o Discord não confirmou o email', async () => {
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

            doDiscord = {
                id: `atacante${marca}`,
                username: `Atacante ${marca}`,
                email,
                verified: false,
            };
            fingirDiscord();

            const ida = await app.inject({
                method: 'GET',
                url: '/api/v1/auth/discord',
            });

            const state = ida.cookies.find(
                (cookie) => cookie.name === 'vicehub_discord_state',
            )?.value as string;

            const resposta = await app.inject({
                method: 'GET',
                url: `/api/v1/auth/discord/callback?code=x&state=${encodeURIComponent(state)}`,
                cookies: { vicehub_discord_state: state },
            });

            expect(resposta.statusCode, resposta.body).toBe(409);
            expect(resposta.json().code).toBe('DISCORD_EMAIL_UNUSABLE');

            /** E nada ficou ligado à conta da vítima. */
            const identidades = await prisma.userAuthProvider.count({
                where: { user: { email }, provider: 'discord' },
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
            doDiscord = {
                id: `state${marca}`,
                username: `State ${marca}`,
                email: `state${marca}@discord.test`,
                verified: true,
            };
            fingirDiscord();

            const resposta = await app.inject({
                method: 'GET',
                url: '/api/v1/auth/discord/callback?code=x&state=inventado',
            });

            expect(resposta.statusCode).toBe(400);
            expect(resposta.json().code).toBe('DISCORD_STATE_MISMATCH');
        });

        it('recusa um regresso com um state que não é o nosso', async () => {
            doDiscord = {
                id: `state2${marca}`,
                username: `State2 ${marca}`,
                email: `state2${marca}@discord.test`,
                verified: true,
            };
            fingirDiscord();

            const ida = await app.inject({
                method: 'GET',
                url: '/api/v1/auth/discord',
            });

            const state = ida.cookies.find(
                (cookie) => cookie.name === 'vicehub_discord_state',
            )?.value as string;

            const resposta = await app.inject({
                method: 'GET',
                url: '/api/v1/auth/discord/callback?code=x&state=outro-qualquer',
                cookies: { vicehub_discord_state: state },
            });

            expect(resposta.statusCode).toBe(400);
        });
    });

    describe('quem desiste', () => {
        /**
         * Carregar em "cancelar" no Discord não é uma avaria: é uma
         * decisão, e o que se faz é levar a pessoa de volta.
         */
        it('volta para a entrada sem erro nenhum', async () => {
            const resposta = await app.inject({
                method: 'GET',
                url: '/api/v1/auth/discord/callback?error=access_denied',
            });

            expect(resposta.statusCode).toBe(302);
            expect(resposta.headers.location).toContain('/entrar');
        });
    });
});
