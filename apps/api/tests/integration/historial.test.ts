import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';
import { tagAoAcaso } from '../helpers/crew-tags.js';

/**
 * O historial de uma pessoa, para quem está a decidir uma denúncia.
 *
 * A denúncia que o moderador tem à frente diz o que aconteceu uma vez.
 * Não diz se é a primeira vez ou a décima, nem se quem denunciou já
 * apresentou quarenta denúncias sem razão — e as duas coisas mudam a
 * decisão. Os números já estavam todos na tabela; não estavam onde a
 * decisão se toma.
 *
 * O que aqui se guarda, acima de tudo, é a regra que distingue isto de
 * um cadastro: **contam-se peças de conteúdo, e não denúncias**. Dez
 * pessoas a denunciar a mesma publicação são dez linhas na tabela e um
 * erro de quem a escreveu, e contá-las fazia de uma campanha
 * organizada um passado.
 */
describe('o historial de quem modera e de quem é moderado', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    let ana: { token: string; id: string; nome: string };
    let bruno: { token: string; id: string; nome: string };
    let carla: { token: string; id: string; nome: string };
    let moderador: { token: string; id: string; nome: string };

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

    interface Historial {
        written: { acted: number; dismissed: number };
        filed: { acted: number; dismissed: number };
    }

    const historial = async (
        quem: { token: string },
        deQuem: { id: string },
    ): Promise<Historial> => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/moderation/users/${deQuem.id}/history`,
            headers: auth(quem.token),
        });

        expect(resposta.statusCode, resposta.body).toBe(200);

        return resposta.json() as Historial;
    };

    const perguntar = async (titulo: string) => {
        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/forum/topics',
            headers: auth(ana.token),
            payload: {
                title: `${titulo} ${marca}`,
                body: 'Um corpo com tamanho suficiente para passar.',
            },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return resposta.json().id as string;
    };

    const denunciarTopico = async (
        quem: { token: string },
        topicId: string,
    ) => {
        const resposta = await app.inject({
            method: 'POST',
            url: `/api/v1/forum/topics/${topicId}/reports`,
            headers: auth(quem.token),
            payload: { reason: 'spam' },
        });

        expect(resposta.statusCode, resposta.body).toBe(201);

        return resposta.json().id as string;
    };

    const decidir = async (reportId: string, outcome: string) => {
        const resposta = await app.inject({
            method: 'POST',
            url: `/api/v1/moderation/reports/${reportId}`,
            headers: auth(moderador.token),
            payload: { outcome },
        });

        expect(resposta.statusCode, resposta.body).toBe(204);
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        ana = await registar(`ha${marca}`);
        bruno = await registar(`hb${marca}`);
        carla = await registar(`hc${marca}`);
        moderador = await registar(`hm${marca}`);

        /**
         * O cargo de moderador dá-se pela base de dados, como o de
         * administrador: não há rota que o alcance, e é assim que se dá
         * na vida real.
         */
        const cargo = await prisma.role.findFirstOrThrow({
            where: { slug: 'moderator' },
            select: { id: true },
        });

        await prisma.userRole.create({
            data: { userId: moderador.id, roleId: cargo.id },
        });

        const servidor = await app.inject({
            method: 'POST',
            url: '/api/v1/servers',
            headers: auth(ana.token),
            payload: { name: `Servidor do historial ${marca}` },
        });

        expect(servidor.statusCode, servidor.body).toBe(201);
        serverId = servidor.json().id as string;
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    it('começa a zero, e isso é uma resposta e não um 404', async () => {
        expect(await historial(moderador, carla)).toEqual({
            written: { acted: 0, dismissed: 0 },
            filed: { acted: 0, dismissed: 0 },
        });
    });

    /**
     * **A regra que distingue isto de um cadastro.**
     *
     * Duas pessoas denunciam a mesma pergunta e um moderador dá razão às
     * duas: são duas linhas na tabela e **um** erro de quem a escreveu.
     * Contar denúncias transformava uma campanha organizada num
     * passado, e é exatamente isso que um moderador não pode confundir.
     */
    it('conta a publicação uma vez, por muitos que a denunciem', async () => {
        const topicId = await perguntar('Denunciada por dois');

        const doBruno = await denunciarTopico(bruno, topicId);
        const daCarla = await denunciarTopico(carla, topicId);

        await decidir(doBruno, 'acted');
        await decidir(daCarla, 'acted');

        expect((await historial(moderador, ana)).written.acted).toBe(1);
    });

    it('e conta à parte o que foi visto e deixado ficar', async () => {
        const topicId = await perguntar('Sem razão nenhuma');

        await decidir(await denunciarTopico(bruno, topicId), 'dismissed');

        const dela = await historial(moderador, ana);

        expect(dela.written.dismissed).toBe(1);
        /** E a contagem das tratadas não mexeu. */
        expect(dela.written.acted).toBe(1);
    });

    /**
     * Uma denúncia por abrir é uma acusação, não um facto. Pô-la numa
     * contagem ao lado do nome de alguém era deixá-la valer antes de
     * alguém a ler.
     */
    it('e não conta o que ainda ninguém decidiu', async () => {
        const antes = await historial(moderador, ana);

        await denunciarTopico(bruno, await perguntar('Ainda por decidir'));

        expect((await historial(moderador, ana)).written).toEqual(antes.written);
    });

    /**
     * A fila é uma só para a plataforma inteira, e o historial também:
     * quem espalha o mesmo comportamento por duas superfícies não tem
     * dois passados limpos.
     */
    it('junta o que se escreveu nas duas superfícies', async () => {
        const anuncio = await app.inject({
            method: 'POST',
            url: `/api/v1/market/servers/${serverId}/listings`,
            headers: auth(ana.token),
            payload: {
                category: 'vehicle',
                title: `Anúncio denunciado ${marca}`,
                body: 'Entrego no parque do porto.',
                price: '250000',
            },
        });

        expect(anuncio.statusCode, anuncio.body).toBe(201);

        const denuncia = await app.inject({
            method: 'POST',
            url: `/api/v1/market/listings/${anuncio.json().id as string}/reports`,
            headers: auth(bruno.token),
            payload: { reason: 'spam' },
        });

        expect(denuncia.statusCode, denuncia.body).toBe(201);

        await decidir(denuncia.json().id as string, 'acted');

        expect((await historial(moderador, ana)).written.acted).toBe(2);
    });

    /**
     * E o outro lado, que é o que falta a quem decide: quem apresenta
     * quarenta denúncias sem razão está a fazer outra coisa que não
     * moderação, e a fila não tinha como o dizer.
     *
     * Deste lado contam-se **denúncias**, e não peças de conteúdo:
     * quarenta denúncias sem razão são quarenta idas à fila de outra
     * pessoa, e é isso que é preciso ver.
     */
    it('conta as denúncias que cada pessoa apresentou, e como acabaram', async () => {
        const doBruno = await historial(moderador, bruno);

        expect(doBruno.filed.acted).toBe(2);
        expect(doBruno.filed.dismissed).toBe(1);

        /** A carla só apresentou uma, e tinha razão. */
        const daCarla = await historial(moderador, carla);

        expect(daCarla.filed).toEqual({ acted: 1, dismissed: 0 });
        expect(daCarla.written).toEqual({ acted: 0, dismissed: 0 });
    });

    /**
     * Estes números só existem para uma decisão, e por isso só se veem
     * de onde ela se toma. Um cadastro à vista de toda a gente era
     * outra coisa, que esta plataforma não tem.
     */
    it('não deixa ver o historial a quem não modera', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/moderation/users/${ana.id}/history`,
            headers: auth(bruno.token),
        });

        expect(resposta.statusCode).toBe(403);
    });

    it('nem a quem não tem sessão', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/moderation/users/${ana.id}/history`,
        });

        expect(resposta.statusCode).toBe(401);
    });

    /**
     * Um moderador de uma crew qualquer não é um moderador da
     * plataforma: a permissão que abre isto é a mesma que abre a fila,
     * e não um cargo numa comunidade.
     */
    it('e um cargo numa crew não abre o historial', async () => {
        const crew = await app.inject({
            method: 'POST',
            url: '/api/v1/crews',
            headers: auth(bruno.token),
            payload: { name: `Crew do historial ${marca}`, tag: tagAoAcaso() },
        });

        expect(crew.statusCode, crew.body).toBe(201);

        const resposta = await app.inject({
            method: 'GET',
            url: `/api/v1/moderation/users/${ana.id}/history`,
            headers: auth(bruno.token),
        });

        expect(resposta.statusCode).toBe(403);
    });
});
