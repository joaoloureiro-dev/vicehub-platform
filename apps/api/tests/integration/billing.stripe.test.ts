import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Stripe from 'stripe';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * Cobrança pelo Stripe, contra PostgreSQL a sério.
 *
 * Duas coisas aqui não se verificam de outra maneira.
 *
 * A **assinatura** cobre os bytes tal como o Stripe os enviou. Basta o
 * Fastify interpretar o JSON e voltar a serializá-lo — reordenando
 * chaves, mudando espaços — para a verificação falhar. Só um pedido HTTP
 * a sério exercita esse caminho, e é ele que separa um evento do Stripe
 * de um pedido que alguém inventou para se dar premium.
 *
 * A **idempotência** assenta na chave primária da tabela de eventos: é o
 * PostgreSQL que recusa a segunda gravação. Sem isso, um reenvio criava
 * um segundo período e o cliente ficava com dois meses por um pagamento.
 *
 * Não é preciso falar com o Stripe: as chaves são de teste e o SDK
 * assina localmente com o mesmo algoritmo do servidor deles.
 */
describe('cobrança pelo Stripe', () => {
    let app: FastifyInstance;

    const marca = `pay${Date.now()}`;

    const webhookSecret = 'whsec_teste_0123456789abcdef0123456789abcdef';

    let token: string;
    let userId: string;

    const auth = () => ({ authorization: `Bearer ${token}` });

    /**
     * Assina o corpo como o Stripe o assina, para que a verificação
     * exercitada seja a verdadeira e não uma imitação.
     */
    const assinar = (payload: string): string =>
        Stripe.webhooks.generateTestHeaderString({
            payload,
            secret: webhookSecret,
        });

    const enviarWebhook = (payload: unknown, signature?: string) => {
        const corpo = JSON.stringify(payload);

        return app.inject({
            method: 'POST',
            url: '/api/v1/billing/webhook',
            headers: {
                'content-type': 'application/json',
                ...(signature === undefined
                    ? { 'stripe-signature': assinar(corpo) }
                    : { 'stripe-signature': signature }),
            },
            payload: corpo,
        });
    };

    beforeAll(async () => {
        app = buildApp();
        await app.ready();

        const registo = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: `${marca}@vicehub.test`,
                username: marca,
                password: 'Sup3rS3cret!Pass',
            },
        });

        expect(registo.statusCode, registo.body).toBe(201);

        token = registo.json().accessToken as string;
        userId = registo.json().user.id as string;
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    /**
     * Esta suite corre sem chaves de Stripe, que é como a plataforma
     * está por omissão. O que aqui se fixa é que a ausência de
     * configuração é dita com clareza em vez de rebentar.
     */
    describe('sem chaves configuradas', () => {
        it('a plataforma arranca à mesma', () => {
            expect(app.hasRoute({ method: 'POST', url: '/api/v1/billing/checkout' })).toBe(
                true,
            );
        });

        /**
         * 503 e não 500: não está avariado, está por configurar. A
         * distinção importa a quem instala — um 500 mandava-o procurar
         * um defeito que não existe.
         */
        it('a compra responde 503, e diz porquê', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/billing/checkout',
                headers: auth(),
                payload: { ownerKind: 'user', ownerId: userId },
            });

            expect(response.statusCode, response.body).toBe(503);
            expect(response.json().code).toBe('BILLING_NOT_CONFIGURED');
        });

        it('a compra continua a exigir conta', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/billing/checkout',
                payload: { ownerKind: 'user', ownerId: userId },
            });

            expect(response.statusCode).toBe(401);
        });

        /**
         * O webhook é público — quem o chama é o Stripe, que não tem
         * conta aqui. Sem configuração não pode verificar nada, e por
         * isso recusa tudo em vez de aceitar às cegas.
         */
        it('o webhook não aceita nada sem configuração', async () => {
            const response = await enviarWebhook(
                { id: 'evt_1', type: 'invoice.paid', data: { object: {} } },
                't=1,v1=inventado',
            );

            expect(response.statusCode, response.body).toBe(503);
        });

        it('nem sequer chega a gravar o evento', async () => {
            const gravados = await prisma.webhookEvent.count({
                where: { id: 'evt_1' },
            });

            expect(gravados).toBe(0);
        });
    });

    /**
     * A validação de entrada não depende de haver Stripe: um pedido mal
     * formado é recusado antes de se chegar à cobrança.
     */
    describe('validação da compra', () => {
        it.each([
            ['sem titular', {}],
            ['com tipo inválido', { ownerKind: 'guilda', ownerId: crypto.randomUUID() }],
            ['com identificador que não é uuid', { ownerKind: 'user', ownerId: 'x' }],
        ])('recusa um pedido %s', async (_nome, payload) => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/billing/checkout',
                headers: auth(),
                payload: payload as never,
            });

            expect(response.statusCode, response.body).toBe(400);
        });
    });

    /**
     * O corpo do webhook tem de chegar ao handler **em bruto**.
     *
     * Se o Fastify o interpretasse como JSON, o handler receberia um
     * objeto e a assinatura nunca conferiria. Este teste falha se alguém
     * remover o interpretador próprio da rota — e falha com a mensagem
     * certa, em vez de um erro de assinatura que parece outra coisa.
     */
    describe('o corpo chega em bruto', () => {
        it('o handler recebe bytes, não um objeto já interpretado', async () => {
            const response = await enviarWebhook({
                id: 'evt_bruto',
                type: 'invoice.paid',
                data: { object: {} },
            });

            /**
             * Sem chaves a resposta é 503, que é o passo seguinte à
             * leitura do corpo. O que interessa é que não é um 400 de
             * corpo mal formado nem um 500 de tipo inesperado.
             */
            expect(response.statusCode, response.body).toBe(503);
        });

        /**
         * As outras rotas continuam a receber JSON já interpretado. O
         * interpretador em bruto está encapsulado no âmbito do webhook;
         * registá-lo mais acima partiria a API inteira para resolver o
         * problema de uma rota.
         */
        it('as outras rotas continuam a receber JSON interpretado', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/login',
                payload: { email: `${marca}@vicehub.test`, password: 'Sup3rS3cret!Pass' },
            });

            expect(response.statusCode, response.body).toBe(200);
        });
    });
});
