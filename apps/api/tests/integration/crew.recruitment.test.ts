import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * O quadro de recrutamento, contra PostgreSQL a sério.
 *
 * Duas coisas se provam aqui, e nenhuma delas se prova com duplos.
 *
 * A primeira é que o quadro só mostra quem disse que recruta — incluindo
 * nos lugares de destaque, que é onde um erro custaria mais: um anúncio
 * pago a dizer uma coisa que a crew nunca disse, no sítio onde as
 * pessoas mais acreditam nele.
 *
 * A segunda é a data. O ecrã de definições manda o formulário inteiro de
 * cada vez que se corrige uma vírgula, e um anúncio que rejuvenesce a
 * cada gravação torna a idade mostrada numa mentira. É o tipo de erro
 * que passa despercebido para sempre, porque nada falha.
 */
describe('o quadro de recrutamento', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let dono: string;
    let aRecrutar: string;
    let calada: string;
    /** Com plano ativo, e calada. Candidata aos lugares de destaque. */
    let premiumCalada: string;

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

    const criarCrew = async (nome: string, tag: string): Promise<string> => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(dono),
            payload: { name: nome, tag },
        });

        expect(response.statusCode, response.body).toBe(201);

        return response.json().id as string;
    };

    const guardar = (crewId: string, payload: Record<string, unknown>) =>
        app.inject({
            method: 'PATCH',
            url: `/api/v1/crews/${crewId}`,
            headers: auth(dono),
            payload,
        });

    /** O quadro: o diretório filtrado por quem recruta. */
    const quadro = async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/crews?recruiting=true&pageSize=50',
        });

        expect(response.statusCode, response.body).toBe(200);

        return response.json() as {
            items: { id: string; recruitingSince: string | null }[];
            featured: { id: string; isRecruiting: boolean }[];
        };
    };

    const lida = (crewId: string) =>
        prisma.crew.findFirstOrThrow({
            where: { id: crewId },
            select: { is_recruiting: true, recruiting_since: true },
        });

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        dono = await register(`rec${marca}`);

        aRecrutar = await criarCrew(`Recruta ${marca}`, `R${marca}`);
        calada = await criarCrew(`Calada ${marca}`, `Q${marca}`);

        expect((await guardar(aRecrutar, { isRecruiting: true })).statusCode).toBe(200);

        /**
         * Uma crew com plano ativo que **não** recruta.
         *
         * É a única candidata a destaque nestes testes, e por isso a
         * única que pode provar que o destaque obedece ao filtro. Sem
         * ela, tirar o filtro do destaque não mudava resultado nenhum e
         * o caso passava a dizer que sim a tudo.
         */
        premiumCalada = await criarCrew(`Paga ${marca}`, `P${marca}`);

        await prisma.subscription.create({
            data: {
                crewId: premiumCalada,
                price_cents: 1000,
                current_period_start: new Date(),
                current_period_end: new Date(
                    Date.now() + 365 * 24 * 60 * 60 * 1000,
                ),
            },
        });
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('mostra quem anunciou que recruta', async () => {
        const ids = (await quadro()).items.map((entrada) => entrada.id);

        expect(ids).toContain(aRecrutar);
    });

    /**
     * A crew calada tem tudo o que se poderia usar para adivinhar que
     * recruta — existe, tem lugares, e o dono é o mesmo. O que não tem é
     * o anúncio, e é só isso que conta.
     */
    it('não mostra quem nunca o disse', async () => {
        const ids = (await quadro()).items.map((entrada) => entrada.id);

        expect(ids).not.toContain(calada);
    });

    it('diz desde quando o anúncio está no ar', async () => {
        const entrada = (await quadro()).items.find(
            (candidata) => candidata.id === aRecrutar,
        );

        expect(entrada?.recruitingSince).toBeTypeOf('string');
    });

    /**
     * Esta é a que interessa.
     *
     * O formulário de definições manda todos os campos de cada vez que
     * se guarda. Se guardar `isRecruiting: true` numa crew que já
     * recrutava voltasse a escrever a data, um anúncio de há três meses
     * passava a ser de hoje sempre que alguém corrigisse a descrição — e
     * a idade que o quadro mostra deixava de querer dizer alguma coisa.
     */
    it('guardar o mesmo estado outra vez não rejuvenesce o anúncio', async () => {
        const antes = await lida(aRecrutar);

        expect(
            (
                await guardar(aRecrutar, {
                    isRecruiting: true,
                    description: 'mexi noutra coisa qualquer',
                })
            ).statusCode,
        ).toBe(200);

        expect((await lida(aRecrutar)).recruiting_since).toEqual(
            antes.recruiting_since,
        );
    });

    it('desligar o anúncio apaga a data, e não a guarda', async () => {
        const desligada = await criarCrew(`Desiste ${marca}`, `D${marca}`);

        await guardar(desligada, { isRecruiting: true });
        expect((await lida(desligada)).recruiting_since).not.toBeNull();

        await guardar(desligada, { isRecruiting: false });

        expect(await lida(desligada)).toEqual({
            is_recruiting: false,
            recruiting_since: null,
        });
    });

    /**
     * Voltar a recrutar é um anúncio novo. Herdar a data do anterior
     * seria dizer que a crew está à espera de gente desde uma altura em
     * que já tinha desistido.
     */
    it('voltar a recrutar recomeça a contagem', async () => {
        const voltou = await criarCrew(`Voltou ${marca}`, `V${marca}`);

        await guardar(voltou, { isRecruiting: true });
        const primeira = (await lida(voltou)).recruiting_since;

        await guardar(voltou, { isRecruiting: false });
        await guardar(voltou, { isRecruiting: true });

        const segunda = (await lida(voltou)).recruiting_since;

        expect(segunda).not.toBeNull();
        expect(segunda?.getTime()).toBeGreaterThanOrEqual(
            (primeira as Date).getTime(),
        );
    });

    /**
     * O lugar de destaque é o que custaria mais caro errar.
     *
     * Uma crew com plano que não recruta, destacada no quadro de
     * recrutamento, é um anúncio pago a dizer uma coisa que a crew nunca
     * disse — e no sítio da página onde as pessoas mais acreditam nele.
     * Quem se candidatasse levava com um silêncio que a plataforma
     * provocou.
     */
    it('não destaca uma crew com plano que não está a recrutar', async () => {
        const { featured } = await quadro();

        expect(featured.map((entrada) => entrada.id)).not.toContain(
            premiumCalada,
        );
    });

    /**
     * A mesma regra dita como invariante, e não sobre uma crew à escolha.
     *
     * Os lugares de destaque são três e rodam entre todas as crews com
     * plano, por isso exigir que uma crew concreta lá esteja é exigir
     * sorte — o teste passava ou falhava conforme o relógio. O que é
     * sempre verdade, e o que interessa, é que **nenhuma** das
     * destacadas no quadro possa estar lá sem recrutar.
     */
    it('nenhuma das destacadas no quadro deixa de estar a recrutar', async () => {
        const { featured } = await quadro();

        expect(
            featured.filter((entrada) => !entrada.isRecruiting),
        ).toEqual([]);
    });

    /**
     * Sem o filtro, o quadro é o diretório inteiro — e a crew calada
     * volta a aparecer. Serve para provar que o caso de cima falha pela
     * razão certa: a crew existe e é listável, o que a tira do quadro é
     * o filtro.
     */
    it('sem o filtro, a crew calada aparece na mesma', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/crews?pageSize=50',
        });

        expect(response.statusCode, response.body).toBe(200);

        const ids = (response.json().items as { id: string }[]).map(
            (entrada) => entrada.id,
        );

        expect(ids).toContain(calada);
    });
});
