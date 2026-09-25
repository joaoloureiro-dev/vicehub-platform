import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';
import { tagAoAcaso } from '../helpers/crew-tags.js';

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
    let serverId: string;

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

    const anunciar = async (titulo: string) => {
        const resposta = await app.inject({
            method: 'POST',
            url: `/api/v1/market/servers/${serverId}/listings`,
            headers: auth(eu.token),
            payload: {
                category: 'vehicle',
                title: titulo,
                body: 'Entrego no parque do porto, à noite.',
                price: '250000',
            },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return { listingId: resposta.json().id as string };
    };

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
            payload: { name: `Export ${marca}`, tag: tagAoAcaso() },
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

        const servidor = await app.inject({
            method: 'POST',
            url: '/api/v1/servers',
            headers: auth(eu.token),
            payload: { name: `Mercado do export ${marca}` },
        });

        expect(servidor.statusCode, servidor.body).toBe(201);
        serverId = servidor.json().id as string;

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

            expect(dados.format).toBe('vicehub.account.v2');
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

        /**
         * O que se escreveu no fórum é texto da pessoa, e a plataforma
         * promete apagá-lo quando ela sai. O que se promete apagar
         * também se tem de poder levar: a saída de mãos vazias e o
         * apagar são a mesma decisão vista de dois lados.
         */
        it('traz o que escreveu no fórum e o que denunciou lá', async () => {
            const outra = await register(`ex${marca}o`);

            const aberto = await app.inject({
                method: 'POST',
                url: '/api/v1/forum/topics',
                headers: auth(eu.token),
                payload: {
                    title: `Uma pergunta que é minha ${marca}`,
                    body: 'E um corpo que também é meu, com o que escrevi.',
                },
            });

            expect(aberto.statusCode, aberto.body).toBe(201);

            const doOutro = await app.inject({
                method: 'POST',
                url: '/api/v1/forum/topics',
                headers: auth(outra.token),
                payload: {
                    title: `Uma pergunta que não é minha ${marca}`,
                    body: 'Um corpo escrito por outra pessoa qualquer.',
                },
            });

            const denunciada = await app.inject({
                method: 'POST',
                url: `/api/v1/forum/topics/${doOutro.json().id as string}/reports`,
                headers: auth(eu.token),
                payload: { reason: 'spam', note: 'A nota que eu escrevi.' },
            });

            expect(denunciada.statusCode, denunciada.body).toBe(201);

            const dados = (await exportar(eu.token)).json();

            expect(dados.forum.topics).toContainEqual(
                expect.objectContaining({
                    id: aberto.json().id,
                    title: `Uma pergunta que é minha ${marca}`,
                }),
            );

            expect(dados.forum.reports).toContainEqual(
                expect.objectContaining({
                    reason: 'spam',
                    note: 'A nota que eu escrevi.',
                }),
            );

            /** E a pergunta de outra pessoa não vem, mesmo tendo sido eu a denunciá-la. */
            expect(JSON.stringify(dados.forum)).not.toContain(
                'Um corpo escrito por outra pessoa qualquer.',
            );
        });

        /**
         * O mercado, que estava a meio de sair.
         *
         * As mensagens e as avaliações vinham debaixo de `forum` — o
         * nome de onde a primeira destas coisas nasceu — e os
         * **anúncios** não vinham de lado nenhum. A política diz que
         * daqui sai tudo o que a plataforma tem sobre a pessoa, e um
         * anúncio é texto dela: o título, a descrição, o preço pedido e
         * o endereço da imagem que lá pôs.
         */
        it('traz os anúncios que pôs à venda', async () => {
            const anuncio = await anunciar(`Um carro meu ${marca}`);

            const dados = (await exportar(eu.token)).json();

            expect(dados.market.listings).toContainEqual(
                expect.objectContaining({
                    id: anuncio.listingId,
                    title: `Um carro meu ${marca}`,
                    body: 'Entrego no parque do porto, à noite.',
                    price: '250000',
                    status: 'open',
                    server: `Mercado do export ${marca}`,
                }),
            );
        });

        /**
         * E leva **os meus**.
         *
         * Uma exportação que traga o mercado inteiro não é uma
         * exportação: é um despejo da base de dados com o nome de outra
         * coisa. O mesmo para os avisos, que aqui nascem os dois do
         * mesmo cenário — o anúncio é dela, o aviso é dela, e nenhum
         * dos dois é meu.
         */
        it('e não leva os anúncios nem os avisos de outra pessoa', async () => {
            const dela = await register(`dona${marca}`);

            /** No servidor dela: anunciar pede que se jogue lá. */
            const servidorDela = await app.inject({
                method: 'POST',
                url: '/api/v1/servers',
                headers: auth(dela.token),
                payload: { name: `Servidor que não é meu ${marca}` },
            });

            expect(servidorDela.statusCode, servidorDela.body).toBe(201);

            const anuncioDela = await app.inject({
                method: 'POST',
                url: `/api/v1/market/servers/${servidorDela.json().id as string}/listings`,
                headers: auth(dela.token),
                payload: {
                    category: 'vehicle',
                    title: `Anúncio que não é meu ${marca}`,
                    body: 'Escrito por outra pessoa qualquer.',
                    price: '99000',
                },
            });

            expect(anuncioDela.statusCode, anuncioDela.body).toBe(201);

            /**
             * E pergunta-lhe uma terceira pessoa, o que lhe dá a ela um
             * aviso. Uma terceira e não eu: se fosse eu a escrever, o
             * título do anúncio dela passava a aparecer no meu ficheiro
             * com razão — a minha mensagem é minha, e diz sobre o que
             * era.
             */
            const terceira = await register(`terc${marca}`);

            const conversa = await app.inject({
                method: 'POST',
                url: `/api/v1/market/listings/${anuncioDela.json().id as string}/conversations`,
                headers: auth(terceira.token),
            });

            expect(conversa.statusCode, conversa.body).toBe(201);

            const escrita = await app.inject({
                method: 'POST',
                url: `/api/v1/market/conversations/${conversa.json().id as string}/messages`,
                headers: auth(terceira.token),
                payload: { body: 'Ainda tens isso à venda?' },
            });

            expect(escrita.statusCode, escrita.body).toBe(201);

            const resposta = await exportar(eu.token);

            /**
             * O título do anúncio dela não aparece em sítio nenhum do
             * meu ficheiro — nem como anúncio, nem como assunto de um
             * aviso que foi para ela e não para mim.
             */
            expect(resposta.body).not.toContain(
                `Anúncio que não é meu ${marca}`,
            );
            expect(resposta.body).not.toContain(
                'Escrito por outra pessoa qualquer.',
            );
        });

        /**
         * E diz o que lhes aconteceu.
         *
         * Um anúncio que já saiu de venda continua a ser texto da
         * pessoa, e a data em que saiu faz parte da história dele: sem
         * ela, o ficheiro mostra um mercado onde nada acabou.
         */
        it('e diz quando um anúncio deixou de estar à venda', async () => {
            const { listingId } = await anunciar(`Vendido ${marca}`);

            const fechado = await app.inject({
                method: 'POST',
                url: `/api/v1/market/listings/${listingId}/close`,
                headers: auth(eu.token),
                payload: { outcome: 'sold' },
            });

            expect(fechado.statusCode, fechado.body).toBe(200);

            const dados = (await exportar(eu.token)).json();

            const anuncio = dados.market.listings.find(
                (um: { id: string }) => um.id === listingId,
            );

            expect(anuncio.status).toBe('sold');
            expect(anuncio.closedAt).toBeTruthy();
        });

        /**
         * Um anúncio retirado da plataforma não sai daqui, e é a mesma
         * regra do fórum: a exportação leva o que **está** na
         * plataforma. Duas grafias da mesma regra — uma para o fórum,
         * outra para o mercado — era a espécie de diferença que ninguém
         * se lembra de ter decidido.
         */
        it('e não traz um anúncio que já foi removido', async () => {
            const { listingId } = await anunciar(`Removido ${marca}`);

            await prisma.marketListing.update({
                where: { id: listingId },
                data: { is_deleted: true, deleted_at: new Date() },
            });

            const resposta = await exportar(eu.token);

            expect(resposta.body).not.toContain(`Removido ${marca}`);
        });

        it('e um anúncio traz exatamente os campos previstos', async () => {
            await anunciar(`Com os campos certos ${marca}`);

            const dados = (await exportar(eu.token)).json();

            expect(dados.market.listings.length).toBeGreaterThan(0);

            for (const anuncio of dados.market.listings) {
                expect(Object.keys(anuncio).sort()).toEqual([
                    'body',
                    'category',
                    'closedAt',
                    'createdAt',
                    'id',
                    'imageUrl',
                    'price',
                    'server',
                    'status',
                    'title',
                ]);
            }
        });

        /**
         * Do aviso sai o que é da pessoa: que foi avisada, de quê,
         * quando e **se já o leu** — o único desses factos que não está
         * em mais lado nenhum. O texto a que ele aponta foi escrito por
         * outra pessoa, e uma exportação leva o que é seu.
         */
        it('traz os avisos que recebeu, sem o texto de quem os causou', async () => {
            const { listingId } = await anunciar(`Com pergunta ${marca}`);

            const compradora = await register(`comp${marca}`);

            const conversa = await app.inject({
                method: 'POST',
                url: `/api/v1/market/listings/${listingId}/conversations`,
                headers: auth(compradora.token),
            });

            expect(conversa.statusCode, conversa.body).toBe(201);

            const escrita = await app.inject({
                method: 'POST',
                url: `/api/v1/market/conversations/${conversa.json().id as string}/messages`,
                headers: auth(compradora.token),
                payload: { body: 'Uma frase que escreveu a compradora.' },
            });

            expect(escrita.statusCode, escrita.body).toBe(201);

            /** E eu respondo-lhe: o que **eu** escrevi é meu para levar. */
            const minha = await app.inject({
                method: 'POST',
                url: `/api/v1/market/conversations/${conversa.json().id as string}/messages`,
                headers: auth(eu.token),
                payload: { body: 'Uma frase que escrevi eu, e é minha.' },
            });

            expect(minha.statusCode, minha.body).toBe(201);

            const resposta = await exportar(eu.token);
            const dados = resposta.json();

            expect(dados.notifications).toContainEqual(
                expect.objectContaining({
                    kind: 'market_message',
                    about: `Com pergunta ${marca}`,
                    readAt: null,
                }),
            );

            expect(dados.market.messages).toContainEqual(
                expect.objectContaining({
                    listing: `Com pergunta ${marca}`,
                    body: 'Uma frase que escrevi eu, e é minha.',
                }),
            );

            /**
             * E o que ela escreveu não vem — nem no aviso que me
             * chegou por causa disso, nem na conversa.
             */
            expect(resposta.body).not.toContain(
                'Uma frase que escreveu a compradora.',
            );
        });

        /**
         * E diz **se já o li**, que é o único facto de um aviso que não
         * está em mais lado nenhum: o resto — a mensagem, a resposta, a
         * avaliação — já está na plataforma. Sem esta data, o ficheiro
         * diz que toda a gente tem tudo por ler.
         */
        it('e diz quais é que já tinha lido', async () => {
            const daCaixa = await app.inject({
                method: 'GET',
                url: '/api/v1/notifications',
                headers: auth(eu.token),
            });

            expect(daCaixa.statusCode, daCaixa.body).toBe(200);

            const umId = daCaixa.json().notifications[0]?.id as string;

            expect(umId).toBeTruthy();

            const marcado = await app.inject({
                method: 'POST',
                url: `/api/v1/notifications/${umId}/read`,
                headers: auth(eu.token),
            });

            expect(marcado.statusCode, marcado.body).toBe(204);

            const dados = (await exportar(eu.token)).json();

            expect(
                dados.notifications.some(
                    (aviso: { readAt: string | null }) => aviso.readAt !== null,
                ),
            ).toBe(true);
        });

        it('e um aviso traz exatamente os campos previstos', async () => {
            const dados = (await exportar(eu.token)).json();

            expect(dados.notifications.length).toBeGreaterThan(0);

            for (const aviso of dados.notifications) {
                expect(Object.keys(aviso).sort()).toEqual([
                    'about',
                    'createdAt',
                    'kind',
                    'readAt',
                ]);
            }
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
