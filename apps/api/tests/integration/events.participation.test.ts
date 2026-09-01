import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * Eventos e divisão por participação, contra PostgreSQL a sério.
 *
 * A propriedade central é fácil de dizer e impossível de verificar com
 * duplos: **só quem tem presença confirmada recebe**, e o peso vem de
 * quem organiza, não de quem propõe a divisão. Entre os dois módulos há
 * guards, restrições da base de dados e uma transação, e é a passagem
 * por tudo isso que estes testes exercitam.
 */
describe('eventos e divisão por participação', () => {
    let app: FastifyInstance;

    const marca = `ev${Date.now()}`;

    let leader: string;
    let leaderId: string;
    let crewId: string;
    let eventId: string;

    /** username → { token, userId } dos membros criados. */
    const membros = new Map<string, { token: string; userId: string }>();

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

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

    const userIdOf = async (token: string): Promise<string> => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/users/me',
            headers: auth(token),
        });

        return response.json().id as string;
    };

    const joinCrew = async (token: string, userId: string): Promise<void> => {
        const pedido = await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/join`,
            headers: auth(token),
        });

        expect(pedido.statusCode, pedido.body).toBe(202);

        const aceite = await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/requests/${userId}/accept`,
            headers: auth(leader),
        });

        expect(aceite.statusCode, aceite.body).toBe(204);
    };

    const createEvent = async (
        payload: Record<string, unknown> = {},
    ): Promise<string> => {
        const response = await app.inject({
            method: 'POST',
            url: `/api/v1/events/crews/${crewId}`,
            headers: auth(leader),
            payload: {
                name: `Assalto ${marca}`,
                startsAt: new Date(Date.now() + 86_400_000).toISOString(),
                ...payload,
            },
        });

        expect(response.statusCode, response.body).toBe(201);

        return response.json().id as string;
    };

    const signUp = (token: string, id = eventId) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/events/crews/${crewId}/${id}/signup`,
            headers: auth(token),
        });

    const confirm = (userId: string, weight?: number, id = eventId) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/events/crews/${crewId}/${id}/participants/${userId}/confirm`,
            headers: auth(leader),
            payload: weight === undefined ? {} : { weight },
        });

    const fund = async (amount: string): Promise<void> => {
        const proposta = await app.inject({
            method: 'POST',
            url: `/api/v1/treasury/crews/${crewId}/movements`,
            headers: auth(leader),
            payload: {
                amount,
                direction: 'credit',
                category: 'contribution',
                description: 'Ganhos de missões',
            },
        });

        expect(proposta.statusCode, proposta.body).toBe(201);

        const aprovacao = await app.inject({
            method: 'POST',
            url: `/api/v1/treasury/crews/${crewId}/movements/${proposta.json().id}/approve`,
            headers: auth(leader),
        });

        expect(aprovacao.statusCode, aprovacao.body).toBe(200);
    };

    const balanceOf = async (userId: string): Promise<bigint> => {
        const carteira = await prisma.wallet.findFirst({ where: { userId } });

        return carteira?.balance ?? 0n;
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        leader = await register(`${marca}l`);
        leaderId = await userIdOf(leader);

        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(leader),
            payload: { name: `Eventos ${marca}`, tag: `E${marca.slice(-5)}` },
        });

        expect(crew.statusCode, crew.body).toBe(201);
        crewId = crew.json().id as string;

        for (const sufixo of ['a', 'b', 'c']) {
            const username = `${marca}${sufixo}`;
            const token = await register(username);
            const userId = await userIdOf(token);

            await joinCrew(token, userId);

            membros.set(sufixo, { token, userId });
        }

        eventId = await createEvent();
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    describe('inscrição', () => {
        it('um membro inscreve-se', async () => {
            const response = await signUp(membros.get('a')?.token as string);

            expect(response.statusCode, response.body).toBe(204);
        });

        it('não se inscreve duas vezes', async () => {
            const response = await signUp(membros.get('a')?.token as string);

            expect(response.statusCode, response.body).toBe(409);
            expect(response.json().code).toBe('ALREADY_SIGNED_UP');
        });

        /**
         * Sem isto, qualquer conta se inscrevia nos eventos de uma crew
         * a que não pertence e, uma vez confirmada, recebia parte dos
         * ganhos dela.
         */
        it('recusa quem não pertence à crew', async () => {
            const estranho = await register(`${marca}x`);

            const response = await signUp(estranho);

            expect(response.statusCode, response.body).toBe(403);
            expect(response.json().code).toBe('NOT_A_MEMBER');
        });

        it('respeita a lotação', async () => {
            const pequeno = await createEvent({ capacity: 1 });

            const primeiro = await signUp(
                membros.get('a')?.token as string,
                pequeno,
            );

            expect(primeiro.statusCode, primeiro.body).toBe(204);

            const segundo = await signUp(membros.get('b')?.token as string, pequeno);

            expect(segundo.statusCode, segundo.body).toBe(409);
            expect(segundo.json().code).toBe('EVENT_FULL');
        });

        /**
         * Quem desiste liberta o lugar: contá-lo faria um evento ficar
         * cheio por causa de quem já disse que não vai.
         */
        it('desistir liberta o lugar', async () => {
            const pequeno = await createEvent({ capacity: 1 });

            await signUp(membros.get('a')?.token as string, pequeno);

            const desistencia = await app.inject({
                method: 'DELETE',
                url: `/api/v1/events/crews/${crewId}/${pequeno}/signup`,
                headers: auth(membros.get('a')?.token as string),
            });

            expect(desistencia.statusCode, desistencia.body).toBe(204);

            const outro = await signUp(membros.get('b')?.token as string, pequeno);

            expect(outro.statusCode, outro.body).toBe(204);
        });
    });

    describe('presenças', () => {
        it('quem organiza confirma, com o peso que atribui', async () => {
            const response = await confirm(membros.get('a')?.userId as string, 3);

            expect(response.statusCode, response.body).toBe(204);

            const participantes = await app.inject({
                method: 'GET',
                url: `/api/v1/events/crews/${crewId}/${eventId}/participants`,
                headers: auth(leader),
            });

            const entrada = (
                participantes.json() as { userId: string; weight: number; status: string }[]
            ).find((p) => p.userId === membros.get('a')?.userId);

            expect(entrada?.status).toBe('confirmed');
            expect(entrada?.weight).toBe(3);
        });

        /**
         * Confirmar presenças é o que dá direito a receber. Um membro
         * comum não o pode fazer, nem sequer a si próprio.
         */
        it('um membro comum não confirma presenças', async () => {
            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/events/crews/${crewId}/${eventId}/participants/${membros.get('a')?.userId}/confirm`,
                headers: auth(membros.get('b')?.token as string),
                payload: { weight: 10 },
            });

            expect(response.statusCode, response.body).toBe(403);
        });

        /**
         * A confirmação é uma afirmação de quem organiza sobre o que
         * aconteceu, e não é de quem participou apagá-la.
         */
        it('quem tem presença confirmada não desiste', async () => {
            const response = await app.inject({
                method: 'DELETE',
                url: `/api/v1/events/crews/${crewId}/${eventId}/signup`,
                headers: auth(membros.get('a')?.token as string),
            });

            expect(response.statusCode, response.body).toBe(404);
            expect(response.json().code).toBe('NOT_SIGNED_UP');
        });

        it('fica gravado quem confirmou e quando', async () => {
            const participante = await prisma.eventParticipant.findFirstOrThrow({
                where: { eventId, userId: membros.get('a')?.userId as string },
                select: { confirmed_by: true, confirmed_at: true },
            });

            expect(participante.confirmed_by).toBe(leaderId);
            expect(participante.confirmed_at).not.toBeNull();
        });
    });

    describe('divisão pelos que participaram', () => {
        beforeAll(async () => {
            await fund('10000');

            /**
             * b participa com peso 1; c inscreve-se mas falta. É a
             * diferença entre os dois que estes testes existem para
             * mostrar.
             */
            await signUp(membros.get('b')?.token as string);
            await signUp(membros.get('c')?.token as string);

            await confirm(membros.get('b')?.userId as string, 1);

            const ausencia = await app.inject({
                method: 'POST',
                url: `/api/v1/events/crews/${crewId}/${eventId}/participants/${membros.get('c')?.userId}/no-show`,
                headers: auth(leader),
            });

            expect(ausencia.statusCode, ausencia.body).toBe(204);
        });

        it('paga pelo peso, e só a quem participou', async () => {
            const antesA = await balanceOf(membros.get('a')?.userId as string);
            const antesB = await balanceOf(membros.get('b')?.userId as string);
            const antesC = await balanceOf(membros.get('c')?.userId as string);

            const proposta = await app.inject({
                method: 'POST',
                url: `/api/v1/treasury/crews/${crewId}/distributions`,
                headers: auth(leader),
                payload: { total: '400', basis: 'participation', eventId },
            });

            expect(proposta.statusCode, proposta.body).toBe(201);
            expect(proposta.json().eventId).toBe(eventId);

            const aprovacao = await app.inject({
                method: 'POST',
                url: `/api/v1/treasury/crews/${crewId}/distributions/${proposta.json().id}/approve`,
                headers: auth(leader),
            });

            expect(aprovacao.statusCode, aprovacao.body).toBe(200);

            /**
             * a tem peso 3 e b peso 1: de 400, saem 300 e 100. c faltou e
             * não recebe nada, apesar de ser membro da crew — que é
             * precisamente o que distingue esta base da divisão por igual.
             */
            expect(
                (await balanceOf(membros.get('a')?.userId as string)) - antesA,
            ).toBe(300n);
            expect(
                (await balanceOf(membros.get('b')?.userId as string)) - antesB,
            ).toBe(100n);
            expect(
                (await balanceOf(membros.get('c')?.userId as string)) - antesC,
            ).toBe(0n);
        });

        /**
         * Sem esta verificação, quem manda numa crew pagava o dinheiro
         * dela aos participantes do evento de outra.
         */
        it('recusa um evento de outra crew', async () => {
            const outroLider = await register(`${marca}o`);

            const outraCrew = await app.inject({
                method: 'POST',
                url: '/api/v1/crews',
                headers: auth(outroLider),
                payload: { name: `Outra ${marca}`, tag: `O${marca.slice(-5)}` },
            });

            const outroEvento = await app.inject({
                method: 'POST',
                url: `/api/v1/events/crews/${outraCrew.json().id}`,
                headers: auth(outroLider),
                payload: {
                    name: 'Evento alheio',
                    startsAt: new Date(Date.now() + 86_400_000).toISOString(),
                },
            });

            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/treasury/crews/${crewId}/distributions`,
                headers: auth(leader),
                payload: {
                    total: '100',
                    basis: 'participation',
                    eventId: outroEvento.json().id,
                },
            });

            expect(response.statusCode, response.body).toBe(404);
            expect(response.json().code).toBe('EVENT_NOT_IN_THIS_TREASURY');
        });

        it('recusa um evento sem presenças confirmadas', async () => {
            const vazio = await createEvent();

            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/treasury/crews/${crewId}/distributions`,
                headers: auth(leader),
                payload: { total: '100', basis: 'participation', eventId: vazio },
            });

            expect(response.statusCode, response.body).toBe(409);
            expect(response.json().code).toBe('NO_CONFIRMED_PARTICIPANTS');
        });

        it('recusa a base por participação sem evento', async () => {
            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/treasury/crews/${crewId}/distributions`,
                headers: auth(leader),
                payload: { total: '100', basis: 'participation' },
            });

            expect(response.statusCode, response.body).toBe(400);
        });

        /**
         * Um evento numa base que o ignora seria aceite em silêncio, e
         * quem o enviou ficaria a achar que contou para alguma coisa.
         */
        it('recusa um evento nas outras bases', async () => {
            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/treasury/crews/${crewId}/distributions`,
                headers: auth(leader),
                payload: { total: '100', basis: 'equal', eventId },
            });

            expect(response.statusCode, response.body).toBe(400);
        });
    });

    describe('estados do evento', () => {
        it('conclui um evento agendado', async () => {
            const alvo = await createEvent();

            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/events/crews/${crewId}/${alvo}/status`,
                headers: auth(leader),
                payload: { status: 'completed' },
            });

            expect(response.statusCode, response.body).toBe(200);
            expect(response.json().status).toBe('completed');
        });

        /**
         * Um evento concluído não volta a começar: insistir reabriria
         * decisões já tomadas.
         */
        it('não reabre um evento concluído', async () => {
            const alvo = await createEvent();

            await app.inject({
                method: 'POST',
                url: `/api/v1/events/crews/${crewId}/${alvo}/status`,
                headers: auth(leader),
                payload: { status: 'completed' },
            });

            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/events/crews/${crewId}/${alvo}/status`,
                headers: auth(leader),
                payload: { status: 'ongoing' },
            });

            expect(response.statusCode, response.body).toBe(409);
            expect(response.json().code).toBe('INVALID_STATUS_TRANSITION');
        });

        it('não confirma presenças num evento cancelado', async () => {
            const alvo = await createEvent();

            await signUp(membros.get('a')?.token as string, alvo);

            await app.inject({
                method: 'POST',
                url: `/api/v1/events/crews/${crewId}/${alvo}/status`,
                headers: auth(leader),
                payload: { status: 'canceled' },
            });

            const response = await confirm(
                membros.get('a')?.userId as string,
                1,
                alvo,
            );

            expect(response.statusCode, response.body).toBe(409);
            expect(response.json().code).toBe('ATTENDANCE_NOT_CONFIRMABLE');
        });
    });

    /**
     * Duas confirmações simultâneas da mesma pessoa não podem criar duas
     * participações: é a chave única por evento e utilizador que o
     * impede, e só a base de dados a sério o pode mostrar.
     */
    it('duas inscrições simultâneas não criam duas participações', async () => {
        const alvo = await createEvent();
        const token = membros.get('a')?.token as string;

        const [primeira, segunda] = await Promise.all([
            signUp(token, alvo),
            signUp(token, alvo),
        ]);

        const codigos = [primeira.statusCode, segunda.statusCode].sort();

        /**
         * Uma passa e a outra é recusada, ou ambas passam por a segunda
         * ter reaproveitado a linha da primeira. O que não pode haver é
         * duas linhas.
         */
        expect(codigos[0]).toBe(204);

        const linhas = await prisma.eventParticipant.count({
            where: { eventId: alvo, userId: membros.get('a')?.userId as string },
        });

        expect(linhas).toBe(1);
    });
});
