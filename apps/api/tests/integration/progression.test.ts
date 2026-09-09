import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import {
    prisma,
    XP_BASE_DO_EVENTO,
    XP_DE_QUEM_APARECEU,
    XP_POR_PRESENCA,
    nivelDoXp,
} from '@vicehub/database';
import { buildApp } from '../../src/app.js';
import { awardEventXp } from '../../src/shared/xp-awards.js';

/**
 * Subir de nível, contra PostgreSQL a sério.
 *
 * O que aqui interessa provar não é que a soma está certa — isso os
 * testes da curva já fazem sem base de dados nenhuma. É que **o mesmo
 * evento não paga duas vezes**, e que isso não depende de o serviço
 * estar bem escrito: a transição para concluído já é condicional e só
 * um pedido a ganha, mas essa é uma garantia que dura enquanto ninguém
 * mexer no serviço. A garantia que dura é o índice, e um índice ou está
 * certo ou deixa passar — não há como saber qual sem uma base a sério.
 */
describe('progressão de crews e jogadores', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let lider: string;
    let membro: string;
    let liderId: string;
    let membroId: string;
    let crewId: string;

    const register = async (username: string) => {
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

        return {
            token: response.json().accessToken as string,
            id: response.json().user.id as string,
        };
    };

    /** Um evento marcado, com toda a gente inscrita e confirmada. */
    const eventoCom = async (quantos: number): Promise<string> => {
        const evento = await app.inject({
            method: 'POST',
            url: `/api/v1/events/crews/${crewId}`,
            headers: auth(lider),
            payload: {
                name: `Assalto ${marca}-${quantos}-${Math.random().toString(36).slice(2, 7)}`,
                startsAt: new Date(Date.now() + 86_400_000).toISOString(),
            },
        });

        expect(evento.statusCode, evento.body).toBe(201);

        const eventId = evento.json().id as string;

        const gente = [
            { token: lider, id: liderId },
            { token: membro, id: membroId },
        ].slice(0, quantos);

        for (const pessoa of gente) {
            const inscricao = await app.inject({
                method: 'POST',
                url: `/api/v1/events/crews/${crewId}/${eventId}/signup`,
                headers: auth(pessoa.token),
            });

            expect(inscricao.statusCode, inscricao.body).toBe(204);

            const confirmacao = await app.inject({
                method: 'POST',
                url: `/api/v1/events/crews/${crewId}/${eventId}/participants/${pessoa.id}/confirm`,
                headers: auth(lider),
                payload: {},
            });

            expect(confirmacao.statusCode, confirmacao.body).toBe(204);
        }

        return eventId;
    };

    const concluir = (eventId: string) =>
        app.inject({
            method: 'POST',
            url: `/api/v1/events/crews/${crewId}/${eventId}/status`,
            headers: auth(lider),
            payload: { status: 'completed' },
        });

    const perfilDaCrew = async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/v1/crews/${crewId}`,
        });

        expect(response.statusCode, response.body).toBe(200);

        return response.json() as {
            level: number;
            xp: string;
            nextLevelXp: string | null;
        };
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        const l = await register(`prg${marca}`);
        const m = await register(`prm${marca}`);

        lider = l.token;
        liderId = l.id;
        membro = m.token;
        membroId = m.id;

        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(lider),
            payload: { name: `Progresso ${marca}`, tag: `P${marca.slice(-6)}` },
        });

        expect(crew.statusCode, crew.body).toBe(201);
        crewId = crew.json().id as string;

        /* O membro entra, para poder aparecer aos eventos. */
        await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/join`,
            headers: auth(membro),
        });

        await app.inject({
            method: 'POST',
            url: `/api/v1/crews/${crewId}/requests/${membroId}/accept`,
            headers: auth(lider),
        });
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('uma crew nasce no nível 1 sem xp nenhum', async () => {
        const perfil = await perfilDaCrew();

        expect(perfil.level).toBe(1);
        expect(perfil.xp).toBe('0');
        expect(perfil.nextLevelXp).toBe('100');
    });

    /**
     * Um evento a que só apareceu quem o marcou não é uma conquista da
     * crew. Sem esta linha, subir de nível sozinho era o caminho mais
     * fácil que havia.
     */
    it('um evento com uma presença só não paga a ninguém', async () => {
        const antes = await perfilDaCrew();

        const eventId = await eventoCom(1);

        expect((await concluir(eventId)).statusCode).toBe(200);

        const depois = await perfilDaCrew();

        expect(depois.xp).toBe(antes.xp);

        const ganhos = await prisma.xpAward.count({ where: { eventId } });

        expect(ganhos).toBe(0);
    });

    it('um evento com duas presenças paga à crew e a quem apareceu', async () => {
        const antesDaCrew = await perfilDaCrew();

        const antesDoMembro = await prisma.user.findUniqueOrThrow({
            where: { id: membroId },
            select: { xp: true },
        });

        const eventId = await eventoCom(2);

        expect((await concluir(eventId)).statusCode).toBe(200);

        const esperado = BigInt(XP_BASE_DO_EVENTO + XP_POR_PRESENCA * 2);

        const depoisDaCrew = await perfilDaCrew();

        expect(BigInt(depoisDaCrew.xp)).toBe(BigInt(antesDaCrew.xp) + esperado);

        const depoisDoMembro = await prisma.user.findUniqueOrThrow({
            where: { id: membroId },
            select: { xp: true, level: true },
        });

        expect(depoisDoMembro.xp).toBe(
            antesDoMembro.xp + BigInt(XP_DE_QUEM_APARECEU),
        );

        /** O nível guardado é o mesmo que a curva dá. */
        expect(depoisDoMembro.level).toBe(nivelDoXp(depoisDoMembro.xp));
        expect(depoisDaCrew.level).toBe(nivelDoXp(BigInt(depoisDaCrew.xp)));
    });

    /**
     * O caminho pela API já não deixa concluir duas vezes — a transição
     * é condicional. Este caso salta por cima disso e chama o pagamento
     * outra vez, que é exatamente o que aconteceria se alguém mudasse o
     * serviço. O índice é que tem de recusar.
     */
    it('o mesmo evento não paga duas vezes, nem passando à frente do serviço', async () => {
        const eventId = await eventoCom(2);

        expect((await concluir(eventId)).statusCode).toBe(200);

        const depoisDoPrimeiro = await perfilDaCrew();

        const repetido = await awardEventXp(prisma, {
            eventId,
            crewId,
            confirmedUserIds: [liderId, membroId],
            actorId: liderId,
        });

        expect(repetido.awarded).toBe(false);

        const depoisDoSegundo = await perfilDaCrew();

        expect(depoisDoSegundo.xp).toBe(depoisDoPrimeiro.xp);

        /** E não ficou meio pago: a transação inteira caiu com o índice. */
        const ganhos = await prisma.xpAward.count({ where: { eventId } });

        expect(ganhos).toBe(3);
    });

    it('sobe de nível quando o xp chega ao limiar', async () => {
        const perfil = await perfilDaCrew();

        expect(BigInt(perfil.xp)).toBeGreaterThanOrEqual(100n);
        expect(perfil.level).toBeGreaterThanOrEqual(2);
        expect(perfil.nextLevelXp).not.toBeNull();
        expect(BigInt(perfil.nextLevelXp as string)).toBeGreaterThan(
            BigInt(perfil.xp),
        );
    });

    /** Cada ganho diz de onde veio: é para isso que a tabela existe. */
    it('deixa o rasto de onde veio cada ganho', async () => {
        const ganhos = await prisma.xpAward.findMany({
            where: { crewId },
            select: { amount: true, reason: true, eventId: true },
        });

        expect(ganhos.length).toBeGreaterThan(0);

        for (const ganho of ganhos) {
            expect(ganho.reason).toBe('event_completed');
            expect(ganho.eventId).not.toBeNull();
            expect(ganho.amount).toBeGreaterThan(0);
        }

        const soma = ganhos.reduce((total, ganho) => total + ganho.amount, 0);
        const perfil = await perfilDaCrew();

        /** A coluna é a soma da lista, e não um número à parte. */
        expect(BigInt(soma)).toBe(BigInt(perfil.xp));
    });

    /**
     * De onde veio o nível, pela API.
     *
     * O total é público; a lista não é. Ela diz os nomes dos eventos, e
     * o calendário de uma comunidade é dela — por isso a rota exige a
     * mesma permissão que ver os eventos.
     */
    describe('a lista de ganhos', () => {
        const pedirXp = (token?: string) =>
            app.inject({
                method: 'GET',
                url: `/api/v1/crews/${crewId}/xp`,
                ...(token === undefined ? {} : { headers: auth(token) }),
            });

        it('mostra a um membro cada ganho e o evento de onde veio', async () => {
            const response = await pedirXp(membro);

            expect(response.statusCode, response.body).toBe(200);

            const ganhos = response.json() as {
                amount: number;
                reason: string;
                at: string;
                event: { id: string; name: string } | null;
            }[];

            expect(ganhos.length).toBeGreaterThan(0);

            for (const ganho of ganhos) {
                expect(ganho.reason).toBe('event_completed');
                expect(ganho.event).not.toBeNull();
                expect(ganho.amount).toBeGreaterThan(0);
                expect(Number.isNaN(Date.parse(ganho.at))).toBe(false);
            }
        });

        /** Do mais recente para o mais antigo: é assim que se lê. */
        it('vem do mais recente para o mais antigo', async () => {
            const ganhos = (await pedirXp(membro)).json() as { at: string }[];

            const datas = ganhos.map((ganho) => Date.parse(ganho.at));

            expect(datas).toEqual([...datas].sort((a, b) => b - a));
        });

        /** A soma da lista é o total do perfil. */
        it('soma exatamente o xp que o perfil mostra', async () => {
            const ganhos = (await pedirXp(membro)).json() as {
                amount: number;
            }[];

            const soma = ganhos.reduce((total, ganho) => total + ganho.amount, 0);

            expect(BigInt(soma)).toBe(BigInt((await perfilDaCrew()).xp));
        });

        it('recusa a quem não pertence à crew', async () => {
            const estranho = await register(`prx${marca}`);

            expect((await pedirXp(estranho.token)).statusCode).toBe(403);
        });

        it('recusa a quem não tem sessão', async () => {
            expect((await pedirXp()).statusCode).toBe(401);
        });
    });

    /**
     * O lugar na classificação, contra a base a sério.
     *
     * A conta é "quantas estão à frente, mais um", e é aqui que se vê se
     * ela está certa: com empates, com crews que ainda não ganharam
     * nada, e com o próprio a contar-se a si mesmo por engano — que é o
     * erro clássico deste tipo de contagem.
     */
    describe('o lugar na classificação', () => {
        /** Uma crew nova, com o xp que se lhe quiser dar. */
        const crewCom = async (xp: bigint, sufixo: string): Promise<string> => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/crews',
                headers: auth(lider),
                payload: {
                    name: `Lugar ${marca}${sufixo}`,
                    tag: `L${sufixo}${marca.slice(-4)}`,
                },
            });

            expect(response.statusCode, response.body).toBe(201);

            const id = response.json().id as string;

            await prisma.crew.update({
                where: { id },
                data: { xp, level: nivelDoXp(xp) },
            });

            return id;
        };

        const lugarDe = async (id: string) => {
            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/crews/${id}`,
            });

            expect(response.statusCode, response.body).toBe(200);

            return response.json().rank as {
                position: number;
                of: number;
            } | null;
        };

        it('quem tem mais xp fica à frente', async () => {
            const muito = await crewCom(10_000_000n, 'a');
            const pouco = await crewCom(9_000_000n, 'b');

            const primeiro = await lugarDe(muito);
            const segundo = await lugarDe(pouco);

            expect(primeiro?.position).toBeLessThan(
                segundo?.position as number,
            );
        });

        /**
         * Duas crews com o mesmo xp partilham o lugar. A alternativa
         * seria desempatar por uma coisa que ninguém ganhou.
         */
        it('empates partilham o mesmo lugar', async () => {
            const uma = await crewCom(8_000_000n, 'c');
            const outra = await crewCom(8_000_000n, 'd');

            expect((await lugarDe(uma))?.position).toBe(
                (await lugarDe(outra))?.position,
            );
        });

        /** Quem ainda não ganhou nada não está em último: não entrou. */
        it('não dá lugar a quem tem zero', async () => {
            expect(await lugarDe(await crewCom(0n, 'e'))).toBeNull();
        });

        /**
         * A posição absoluta, e não apenas a ordem relativa.
         *
         * É o caso que apanha o erro clássico desta contagem: contar com
         * `>=` em vez de `>` põe cada crew à frente de si própria, e a
         * primeira de todas passa a aparecer em segundo. Comparar duas
         * crews entre si não dá por isso — as duas erram na mesma
         * medida. Só um número exato o revela.
         */
        it('a que tem mais xp de todas fica em primeiro', async () => {
            const maior = await prisma.crew.aggregate({
                where: { is_deleted: false },
                _max: { xp: true },
            });

            const acimaDeTodas = (maior._max.xp ?? 0n) + 1_000n;

            const lugar = await lugarDe(await crewCom(acimaDeTodas, 'f'));

            expect(lugar?.position).toBe(1);
            expect(lugar?.of).toBeGreaterThanOrEqual(1);
        });
    });
});
