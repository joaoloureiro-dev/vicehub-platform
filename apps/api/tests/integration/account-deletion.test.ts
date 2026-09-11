import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * Apagar a própria conta, contra PostgreSQL a sério.
 *
 * O que se quer provar não é o HTTP: é **o que fica e o que sai**. A
 * linha entre as duas coisas é esta — o que identifica uma pessoa sai, o
 * que outras pessoas precisam para as contas baterem certo fica. Um
 * movimento proposto, uma presença num evento por que outros foram
 * pagos: nada disso é da pessoa que saiu, é da crew.
 *
 * E há uma parte que só a base de dados pode provar: `email` e
 * `username` são únicos com uma chave que **não** filtra `is_deleted`.
 * Sem a troca pela lápide, o nome ficava preso para sempre a uma conta
 * que já não existe — e a plataforma dizia que estava livre.
 */
describe('apagar a própria conta', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;

    const PASSWORD = 'Sup3rS3cret!Pass';

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

    const apagar = (
        token: string,
        payload: { confirmation: string; password?: string },
    ) =>
        app.inject({
            method: 'DELETE',
            url: '/api/v1/users/me',
            headers: auth(token),
            payload,
        });

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    describe('o que é preciso para sair', () => {
        it('recusa com a password errada, e não apaga nada', async () => {
            const eu = await register(`pw${marca}`);

            const resposta = await apagar(eu.token, {
                confirmation: eu.username,
                password: 'ErradaErrada!1',
            });

            expect(resposta.statusCode, resposta.body).toBe(403);
            expect(resposta.json().code).toBe('ACCOUNT_DELETION_NOT_CONFIRMED');

            const ainda = await prisma.user.findFirstOrThrow({
                where: { id: eu.id },
                select: { is_deleted: true },
            });

            expect(ainda.is_deleted).toBe(false);
        });

        it('recusa com o nome escrito ao lado', async () => {
            const eu = await register(`nm${marca}`);

            const resposta = await apagar(eu.token, {
                confirmation: 'outra-coisa',
                password: PASSWORD,
            });

            expect(resposta.statusCode, resposta.body).toBe(403);
        });

        it('exige conta: sem sessão não se apaga nada', async () => {
            const resposta = await app.inject({
                method: 'DELETE',
                url: '/api/v1/users/me',
                payload: { confirmation: 'seja-quem-for' },
            });

            expect(resposta.statusCode).toBe(401);
        });
    });

    describe('o que fica preso atrás', () => {
        /**
         * Uma crew sem ninguém que a possa gerir deixa presas as pessoas
         * que lá estão: não há quem a mude, quem a apague, nem quem
         * responda a candidaturas.
         */
        it('recusa a quem é a única pessoa que manda numa crew', async () => {
            const eu = await register(`lider${marca}`);

            const crew = await app.inject({
                method: 'POST',
                url: '/api/v1/crews',
                headers: auth(eu.token),
                payload: { name: `Crew ${marca}`, tag: `L${marca.slice(-6)}` },
            });

            expect(crew.statusCode, crew.body).toBe(201);

            const resposta = await apagar(eu.token, {
                confirmation: eu.username,
                password: PASSWORD,
            });

            expect(resposta.statusCode, resposta.body).toBe(409);
            expect(resposta.json().code).toBe('ACCOUNT_LEADS_COMMUNITIES');
            /** E diz qual, para não obrigar a procurá-la. */
            expect(resposta.json().message).toContain(`Crew ${marca}`);
        });

        /**
         * E deixa de recusar quando a comunidade sai do caminho. Sem
         * este caso, o teste acima passava com uma recusa cega a
         * qualquer pessoa que alguma vez tivesse criado uma crew.
         */
        it('deixa apagar depois de a crew ser apagada', async () => {
            const eu = await register(`solta${marca}`);

            const crew = await app.inject({
                method: 'POST',
                url: '/api/v1/crews',
                headers: auth(eu.token),
                payload: { name: `Solta ${marca}`, tag: `S${marca.slice(-6)}` },
            });

            const crewId = crew.json().id as string;

            expect(
                (
                    await app.inject({
                        method: 'DELETE',
                        url: `/api/v1/crews/${crewId}`,
                        headers: auth(eu.token),
                    })
                ).statusCode,
            ).toBe(204);

            const resposta = await apagar(eu.token, {
                confirmation: eu.username,
                password: PASSWORD,
            });

            expect(resposta.statusCode, resposta.body).toBe(204);
        });
    });

    describe('o que sai e o que fica', () => {
        it('leva tudo o que identifica a pessoa', async () => {
            const eu = await register(`sai${marca}`);

            await app.inject({
                method: 'PATCH',
                url: '/api/v1/users/me',
                headers: auth(eu.token),
                payload: { bio: 'Jogo à noite.', avatarUrl: null },
            });

            expect(
                (
                    await apagar(eu.token, {
                        confirmation: eu.username,
                        password: PASSWORD,
                    })
                ).statusCode,
            ).toBe(204);

            const lapide = await prisma.user.findFirstOrThrow({
                where: { id: eu.id },
                select: {
                    email: true,
                    username: true,
                    bio: true,
                    avatarUrl: true,
                    banner_url: true,
                    accent_color: true,
                    email_verified_at: true,
                    is_deleted: true,
                },
            });

            expect(lapide.is_deleted).toBe(true);
            expect(lapide.bio).toBeNull();
            expect(lapide.avatarUrl).toBeNull();
            expect(lapide.banner_url).toBeNull();
            expect(lapide.accent_color).toBeNull();
            expect(lapide.email_verified_at).toBeNull();

            /** Nem o endereço nem o nome antigos ficam em lado nenhum. */
            expect(lapide.email).not.toContain(`sai${marca}`);
            expect(lapide.username).not.toBe(eu.username);
            expect(lapide.username.startsWith('apagado-')).toBe(true);
        });

        /**
         * **A password e as identidades de fora são apagadas mesmo.**
         *
         * Um hash de password é derivado de uma password que a pessoa
         * provavelmente usa noutro sítio, e uma identidade de Discord é
         * o identificador dela num serviço que não é nosso. Guardá-los
         * marcados como apagados era dizer que se apagou e não ter
         * apagado.
         */
        it('apaga a password mesmo, e não a marca como apagada', async () => {
            const eu = await register(`cred${marca}`);

            await apagar(eu.token, {
                confirmation: eu.username,
                password: PASSWORD,
            });

            expect(
                await prisma.userCredential.count({ where: { userId: eu.id } }),
            ).toBe(0);
            expect(
                await prisma.userAuthProvider.count({ where: { userId: eu.id } }),
            ).toBe(0);
        });

        /**
         * As sessões abertas ficam marcadas como revogadas.
         *
         * Não é o que fecha a porta — quem valida um token lê
         * `is_deleted` do utilizador antes de tudo o resto —, é o que
         * impede a base de dados de continuar a dizer que há uma sessão
         * ativa numa conta que já não existe. Uma linha de sessão guarda
         * o endereço e o browser de quem a abriu: deixá-la por revogar
         * era guardar isso como se ainda estivesse em uso.
         */
        it('marca como revogadas as sessões que estavam abertas', async () => {
            const eu = await register(`sess${marca}`);

            expect(
                await prisma.authSession.count({
                    where: { userId: eu.id, status: 'active' },
                }),
            ).toBeGreaterThan(0);

            await apagar(eu.token, {
                confirmation: eu.username,
                password: PASSWORD,
            });

            expect(
                await prisma.authSession.count({
                    where: { userId: eu.id, status: 'active' },
                }),
            ).toBe(0);

            /** E os tokens que as renovavam também. */
            expect(
                await prisma.refreshToken.count({
                    where: { session: { userId: eu.id }, revoked_at: null },
                }),
            ).toBe(0);
        });

        /**
         * **Um cargo numa comunidade já apagada não prende ninguém.**
         *
         * Hoje apagar uma crew marca também os cargos dela como
         * apagados, e por isso este estado não chega a acontecer pela
         * aplicação — o teste constrói-o à mão de propósito. O que ele
         * guarda é a ligação entre dois módulos: no dia em que apagar
         * uma comunidade deixar de arrastar os cargos, toda a gente que
         * alguma vez liderou uma crew fica impedida de sair, e o erro
         * não aparece em lado nenhum senão aqui.
         */
        it('um cargo numa comunidade apagada não impede a saída', async () => {
            const eu = await register(`fantasma${marca}`);

            const crew = await app.inject({
                method: 'POST',
                url: '/api/v1/crews',
                headers: auth(eu.token),
                payload: {
                    name: `Fantasma ${marca}`,
                    tag: `F${marca.slice(-6)}`,
                },
            });

            const crewId = crew.json().id as string;

            /** A crew desaparece e o cargo fica para trás, ativo. */
            await prisma.crew.update({
                where: { id: crewId },
                data: { is_deleted: true, deleted_at: new Date() },
            });

            expect(
                await prisma.userRole.count({
                    where: { userId: eu.id, crewId, is_deleted: false },
                }),
            ).toBeGreaterThan(0);

            const resposta = await apagar(eu.token, {
                confirmation: eu.username,
                password: PASSWORD,
            });

            expect(resposta.statusCode, resposta.body).toBe(204);
        });

        /**
         * O registo de auditoria fica, e fica de propósito: o esquema
         * não lhe põe sequer chave estrangeira para o utilizador,
         * precisamente para que apagar a conta não possa apagar o rasto.
         */
        it('não toca no registo de auditoria', async () => {
            const eu = await register(`audit${marca}`);

            /**
             * A linha é escrita aqui em vez de vir de uma ação da
             * plataforma: o que se prova é que **apagar não lhe mexe**,
             * e fazê-lo depender de que ações estão auditadas hoje
             * tornava este teste refém de uma decisão que não é a dele.
             */
            await prisma.auditLog.create({
                data: {
                    actor_id: eu.id,
                    action: 'treasury.expense.approved',
                    entity_type: 'Transaction',
                    entity_id: `t-${marca}`,
                },
            });

            await apagar(eu.token, {
                confirmation: eu.username,
                password: PASSWORD,
            });

            const rasto = await prisma.auditLog.findFirstOrThrow({
                where: { actor_id: eu.id },
                select: { action: true, entity_id: true },
            });

            expect(rasto.action).toBe('treasury.expense.approved');
            expect(rasto.entity_id).toBe(`t-${marca}`);
        });
    });

    /**
     * **A razão de isto não ser um `DELETE` da linha do utilizador.**
     *
     * Uma presença num evento é o registo por que outras pessoas foram
     * pagas, e um movimento proposto é uma linha da tesouraria de uma
     * crew. Nada disso é da pessoa que saiu. Apagá-lo deixava as contas
     * da crew a não somar, e ninguém saberia porquê.
     *
     * A chave estrangeira desta tabela é `onDelete: Cascade`: o dia em
     * que alguém trocar esta eliminação por um `delete` a sério, estas
     * linhas desaparecem em silêncio. É este teste que o apanha.
     */
    describe('o que é das comunidades fica', () => {
        it('guarda a presença em eventos por que outros foram pagos', async () => {
            const dono = await register(`dono${marca}`);
            const eu = await register(`presente${marca}`);

            const crew = await app.inject({
                method: 'POST',
                url: '/api/v1/crews',
                headers: auth(dono.token),
                payload: { name: `Eventos ${marca}`, tag: `E${marca.slice(-6)}` },
            });

            expect(crew.statusCode, crew.body).toBe(201);

            const evento = await app.inject({
                method: 'POST',
                url: `/api/v1/events/crews/${crew.json().id as string}`,
                headers: auth(dono.token),
                payload: {
                    name: `Assalto ${marca}`,
                    startsAt: new Date(Date.now() + 86_400_000).toISOString(),
                },
            });

            expect(evento.statusCode, evento.body).toBe(201);

            const participacao = await prisma.eventParticipant.create({
                data: {
                    eventId: evento.json().id as string,
                    userId: eu.id,
                    status: 'confirmed',
                    weight: 2,
                    /**
                     * A base de dados exige os dois quando a presença
                     * está confirmada: uma confirmação sem quem a deu
                     * não prova nada.
                     */
                    confirmed_by: dono.id,
                    confirmed_at: new Date(),
                },
                select: { id: true },
            });

            expect(
                (
                    await apagar(eu.token, {
                        confirmation: eu.username,
                        password: PASSWORD,
                    })
                ).statusCode,
            ).toBe(204);

            const depois = await prisma.eventParticipant.findFirstOrThrow({
                where: { id: participacao.id },
                select: { status: true, weight: true, is_deleted: true },
            });

            expect(depois.is_deleted).toBe(false);
            expect(depois.status).toBe('confirmed');
            expect(depois.weight).toBe(2);
        });

        /**
         * E o que fica passa a estar em nome de uma lápide: o registo
         * continua lá e não diz quem foi.
         */
        it('a linha que fica aponta para um nome que não diz nada', async () => {
            const eu = await register(`lapide${marca}`);

            await apagar(eu.token, {
                confirmation: eu.username,
                password: PASSWORD,
            });

            const lapide = await prisma.user.findFirstOrThrow({
                where: { id: eu.id },
                select: { username: true, email: true },
            });

            expect(lapide.username).toBe(
                `apagado-${eu.id.replaceAll('-', '').slice(0, 12)}`,
            );
            expect(lapide.email.endsWith('@vicehub.invalid')).toBe(true);
        });
    });

    describe('depois de sair', () => {
        /**
         * **O nome volta a estar livre.**
         *
         * `username` é único com uma chave que não filtra `is_deleted`.
         * Sem a troca pela lápide, a plataforma dizia que o nome estava
         * livre — `usernameTaken` filtra por `is_deleted` — e a gravação
         * rebentava contra a chave única. Quem registasse a seguir via
         * um erro interno sem explicação nenhuma.
         */
        it('devolve o nome e o email a quem vier a seguir', async () => {
            const nome = `volta${marca}`;
            const eu = await register(nome);

            await apagar(eu.token, {
                confirmation: nome,
                password: PASSWORD,
            });

            const outra = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/register',
                payload: {
                    email: `${nome}@vicehub.test`,
                    username: nome,
                    password: PASSWORD,
                },
            });

            expect(outra.statusCode, outra.body).toBe(201);
            expect(outra.json().user.id).not.toBe(eu.id);
        });

        it('não deixa entrar com a password antiga', async () => {
            const nome = `entra${marca}`;
            const eu = await register(nome);

            await apagar(eu.token, {
                confirmation: nome,
                password: PASSWORD,
            });

            const entrada = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/login',
                payload: { email: `${nome}@vicehub.test`, password: PASSWORD },
            });

            expect(entrada.statusCode).toBe(401);
        });

        /**
         * O access token vive os seus quinze minutos sem consultar a
         * sessão. Incrementar `token_version` é o que o mata já — sem
         * isso, ficavam quinze minutos de acesso a uma conta apagada.
         */
        it('o token que estava em uso deixa de servir', async () => {
            const eu = await register(`token${marca}`);

            await apagar(eu.token, {
                confirmation: eu.username,
                password: PASSWORD,
            });

            const resposta = await app.inject({
                method: 'GET',
                url: '/api/v1/users/me',
                headers: auth(eu.token),
            });

            expect(resposta.statusCode).toBe(401);
        });

        it('o perfil público deixa de existir', async () => {
            const nome = `perfil${marca}`;
            const eu = await register(nome);

            await apagar(eu.token, { confirmation: nome, password: PASSWORD });

            const resposta = await app.inject({
                method: 'GET',
                url: `/api/v1/users/${nome}`,
            });

            expect(resposta.statusCode).toBe(404);
        });
    });
});
