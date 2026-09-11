import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * Levar os dados consigo, contra PostgreSQL a sério.
 *
 * Duas perguntas, e a segunda é a que importa mais: **está cá tudo o
 * que é meu?** e **não está cá nada que não devia sair daqui?**
 *
 * A segunda é a que se pode falhar em silêncio. Um campo novo no
 * esquema entra numa exportação escrita com `select: *` sem ninguém
 * reparar, e o dia em que esse campo for um hash de password, a
 * plataforma passa a entregá-lo a pedido numa pasta de Downloads.
 */
describe('levar os dados consigo', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;

    const PASSWORD = 'Sup3rS3cret!Pass';

    let eu: { token: string; id: string; username: string };
    let crewId: string;
    let eventoId: string;

    const register = async (nome: string) => {
        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: `${nome}@vicehub.test`,
                username: nome,
                password: PASSWORD,
            },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return {
            token: resposta.json().accessToken as string,
            id: resposta.json().user.id as string,
            username: nome,
        };
    };

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    const exportar = (token: string) =>
        app.inject({
            method: 'GET',
            url: '/api/v1/users/me/export',
            headers: auth(token),
        });

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        eu = await register(`exp${marca}`);

        await app.inject({
            method: 'PATCH',
            url: '/api/v1/users/me',
            headers: auth(eu.token),
            payload: { bio: 'Jogo à noite.' },
        });

        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(eu.token),
            payload: { name: `Export ${marca}`, tag: `X${marca.slice(-6)}` },
        });

        expect(crew.statusCode, crew.body).toBe(201);
        crewId = crew.json().id as string;

        const evento = await app.inject({
            method: 'POST',
            url: `/api/v1/events/crews/${crewId}`,
            headers: auth(eu.token),
            payload: {
                name: `Assalto ${marca}`,
                startsAt: new Date(Date.now() + 86_400_000).toISOString(),
            },
        });

        expect(evento.statusCode, evento.body).toBe(201);
        eventoId = evento.json().id as string;

        await prisma.eventParticipant.create({
            data: {
                eventId: eventoId,
                userId: eu.id,
                status: 'confirmed',
                weight: 3,
                confirmed_by: eu.id,
                confirmed_at: new Date(),
            },
        });
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    describe('está cá o que é meu', () => {
        it('traz a conta e o perfil', async () => {
            const resposta = await exportar(eu.token);

            expect(resposta.statusCode, resposta.body).toBe(200);

            const dados = resposta.json();

            expect(dados.format).toBe('vicehub.account.v1');
            expect(dados.exportedAt).toBeTruthy();
            expect(dados.account.email).toBe(`exp${marca}@vicehub.test`);
            expect(dados.account.username).toBe(eu.username);
            expect(dados.profile.bio).toBe('Jogo à noite.');
        });

        it('traz as comunidades e o cargo que lá tem', async () => {
            const dados = (await exportar(eu.token)).json();

            const crew = dados.communities.find(
                (linha: { id: string }) => linha.id === crewId,
            );

            expect(crew).toMatchObject({
                kind: 'crew',
                name: `Export ${marca}`,
            });
            expect(crew.roles).toContain('crew_leader');
        });

        it('traz os eventos em que esteve, e com que peso', async () => {
            const dados = (await exportar(eu.token)).json();

            expect(dados.events).toContainEqual(
                expect.objectContaining({
                    id: eventoId,
                    name: `Assalto ${marca}`,
                    participation: 'confirmed',
                    weight: 3,
                }),
            );
        });

        /**
         * O xp é um inteiro de 64 bits, e `JSON.stringify` não sabe
         * escrever um. Sem o converter para texto, um número grande de
         * mais perdia dígitos em silêncio ao ser lido de volta — ou a
         * resposta inteira rebentava.
         */
        it('escreve os números grandes como texto, sem perder dígitos', async () => {
            const enorme = 9_007_199_254_740_993n;

            await prisma.user.update({
                where: { id: eu.id },
                data: { xp: enorme },
            });

            const dados = (await exportar(eu.token)).json();

            expect(dados.profile.xp).toBe(enorme.toString());
        });

        it('vai como ficheiro, com a data no nome', async () => {
            const resposta = await exportar(eu.token);

            const disposicao = resposta.headers['content-disposition'] as string;

            expect(disposicao).toContain('attachment');
            expect(disposicao).toContain(eu.username);
            expect(disposicao).toContain(new Date().toISOString().slice(0, 10));
        });
    });

    describe('não está cá o que não devia sair', () => {
        /**
         * **O caso que dá razão a esta suite toda.**
         *
         * Um hash de password num ficheiro que vai parar aos Downloads
         * transformava o direito de levar os dados numa forma de os
         * perder. O mesmo para os tokens de sessão e para os links de
         * recuperação por usar: nada disso é informação sobre a pessoa,
         * é a maneira de entrar na conta dela.
         */
        it('não leva a password, nem tokens, nem links de recuperação', async () => {
            const bruto = (await exportar(eu.token)).body;

            for (const proibido of [
                'password_hash',
                'passwordHash',
                'token_hash',
                'tokenHash',
                'refresh',
                'argon2',
                '$argon',
            ]) {
                expect(bruto).not.toContain(proibido);
            }
        });

        /**
         * **A guarda contra o que ainda não existe.**
         *
         * Os testes acima procuram nomes que já se sabe serem
         * proibidos. Este faz o contrário: fixa a lista do que **é**
         * suposto sair, e por isso apanha um campo que ninguém previu —
         * uma coluna nova na tabela, uma leitura em bloco que substituiu
         * uma escolhida. É essa a forma como uma exportação passa a
         * dizer mais do que devia: por crescimento, e não por descuido
         * visível.
         */
        it('a conta traz exatamente os campos previstos, e nenhum a mais', async () => {
            const dados = (await exportar(eu.token)).json();

            expect(Object.keys(dados.account).sort()).toEqual([
                'createdAt',
                'email',
                'emailVerifiedAt',
                'id',
                'lastLoginAt',
                'username',
            ]);

            expect(Object.keys(dados.profile).sort()).toEqual([
                'accentColor',
                'avatarUrl',
                'bannerUrl',
                'bio',
                'level',
                'reputation',
                'xp',
            ]);
        });

        /**
         * O mesmo para as listas, e por uma razão mais afiada: cada
         * linha destas vem de uma tabela que guarda coisas que não são
         * para sair — o identificador desta pessoa no Discord está na
         * mesma linha que a data em que se ligou.
         */
        it('cada forma de entrar traz exatamente os campos previstos', async () => {
            const dados = (await exportar(eu.token)).json();

            expect(dados.signInMethods.length).toBeGreaterThan(0);

            for (const metodo of dados.signInMethods) {
                expect(Object.keys(metodo).sort()).toEqual([
                    'linkedAt',
                    'provider',
                    'providerEmail',
                ]);
            }
        });

        /**
         * E não leva a password em claro, que é a forma mais óbvia de
         * falhar isto e a que mais depressa passa despercebida.
         */
        it('não leva a password em claro', async () => {
            expect((await exportar(eu.token)).body).not.toContain(PASSWORD);
        });

        /**
         * De quem está do outro lado de uma amizade vai o nome público
         * e mais nada — o mesmo que qualquer pessoa vê ao abrir o
         * perfil. O email de outra pessoa não é meu para levar.
         */
        it('não leva o email de mais ninguém', async () => {
            const outra = await register(`amiga${marca}`);

            await prisma.friendship.create({
                data: {
                    userAId: eu.id < outra.id ? eu.id : outra.id,
                    userBId: eu.id < outra.id ? outra.id : eu.id,
                    status: 'active',
                    requested_by: eu.id,
                },
            });

            const resposta = await exportar(eu.token);
            const dados = resposta.json();

            expect(dados.friends).toContainEqual(
                expect.objectContaining({ username: outra.username }),
            );
            expect(resposta.body).not.toContain(
                `amiga${marca}@vicehub.test`,
            );
        });
    });

    describe('é só a minha', () => {
        it('exige conta', async () => {
            const resposta = await app.inject({
                method: 'GET',
                url: '/api/v1/users/me/export',
            });

            expect(resposta.statusCode).toBe(401);
        });

        /**
         * Não há forma de pedir a conta de outra pessoa: o titular vem
         * da sessão e não do endereço. O que este teste guarda é que
         * continua a ser assim — duas sessões, dois ficheiros
         * diferentes.
         */
        it('cada sessão leva a sua, e só a sua', async () => {
            const outra = await register(`outra${marca}`);

            const minha = (await exportar(eu.token)).json();
            const dela = (await exportar(outra.token)).json();

            expect(minha.account.id).toBe(eu.id);
            expect(dela.account.id).toBe(outra.id);
            expect(dela.account.email).not.toBe(minha.account.email);
        });
    });
});
