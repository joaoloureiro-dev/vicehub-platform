import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';

const WEBHOOK_SECRET = 'whsec_teste_0123456789abcdef0123456789abcdef';

/**
 * O webhook do Stripe com a cobrança configurada.
 *
 * Duas garantias vivem aqui e em mais lado nenhum.
 *
 * A **assinatura** cobre os bytes tal como o Stripe os enviou. Basta o
 * Fastify interpretar o JSON e voltar a serializá-lo para a verificação
 * falhar, e é ela que separa um evento verdadeiro de um pedido que
 * alguém inventou para se dar premium. Só um pedido HTTP a sério, com
 * uma assinatura gerada pelo mesmo algoritmo do Stripe, exercita esse
 * caminho.
 *
 * A **idempotência** assenta na chave primária da tabela de eventos: é o
 * PostgreSQL que recusa a segunda gravação. Sem isso, um reenvio — que o
 * Stripe faz sempre que não recebe resposta a tempo — criava um segundo
 * período, e o cliente ficava com dois meses por um pagamento.
 *
 * Nenhum dos testes fala com o Stripe: a assinatura é gerada localmente,
 * e os eventos escolhidos são tratados até ao ponto anterior a qualquer
 * chamada à API deles.
 */
describe('webhook do Stripe, com a cobrança configurada', () => {
    let app: FastifyInstance;

    const marca = `hook${Date.now()}`;

    beforeAll(async () => {
        /**
         * A configuração é lida uma vez, quando o módulo carrega. Para a
         * ter diferente nestes testes é preciso repor os módulos e voltar
         * a importar a aplicação.
         */
        vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_0123456789abcdef');
        vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET);
        vi.stubEnv('STRIPE_PRICE_ID', 'price_teste');
        vi.stubEnv('STRIPE_SUCCESS_URL', 'https://app.vicehub.test/ok');
        vi.stubEnv('STRIPE_CANCEL_URL', 'https://app.vicehub.test/cancelado');

        vi.resetModules();

        const { buildApp } = await import('../../src/app.js');

        app = buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        vi.unstubAllEnvs();
        vi.resetModules();
        await prisma.$disconnect();
    });

    const assinar = (payload: string): string =>
        Stripe.webhooks.generateTestHeaderString({
            payload,
            secret: WEBHOOK_SECRET,
        });

    const enviar = (payload: unknown, signature?: string) => {
        const corpo = JSON.stringify(payload);

        return app.inject({
            method: 'POST',
            url: '/api/v1/billing/webhook',
            headers: {
                'content-type': 'application/json',
                'stripe-signature': signature ?? assinar(corpo),
            },
            payload: corpo,
        });
    };

    /**
     * Uma sessão de compra sem subscrição. É tratada até ao ponto
     * anterior a qualquer chamada ao Stripe, o que permite exercitar a
     * assinatura e a idempotência sem rede.
     */
    const sessaoSemSubscricao = (id: string) => ({
        id,
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_1', subscription: null } },
    });

    describe('a assinatura é o que protege a rota', () => {
        it('recusa um evento sem assinatura nenhuma', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/billing/webhook',
                headers: { 'content-type': 'application/json' },
                payload: JSON.stringify(sessaoSemSubscricao('evt_sem_assinatura')),
            });

            expect(response.statusCode, response.body).toBe(400);
            expect(response.json().code).toBe('INVALID_WEBHOOK_SIGNATURE');
        });

        it('recusa uma assinatura inventada', async () => {
            const response = await enviar(
                sessaoSemSubscricao('evt_inventado'),
                't=1,v1=0000000000000000000000000000000000000000000000000000000000000000',
            );

            expect(response.statusCode, response.body).toBe(400);
            expect(response.json().code).toBe('INVALID_WEBHOOK_SIGNATURE');
        });

        /**
         * A garantia central: uma assinatura válida para **outro** corpo
         * não serve para este. É isto que impede alguém de apanhar um
         * evento verdadeiro e trocar-lhe o conteúdo.
         */
        it('recusa uma assinatura válida para outro corpo', async () => {
            const assinaturaDeOutro = assinar(
                JSON.stringify(sessaoSemSubscricao('evt_original')),
            );

            const response = await enviar(
                sessaoSemSubscricao('evt_adulterado'),
                assinaturaDeOutro,
            );

            expect(response.statusCode, response.body).toBe(400);
            expect(response.json().code).toBe('INVALID_WEBHOOK_SIGNATURE');
        });

        it('nada do que é recusado chega a ser gravado', async () => {
            const gravados = await prisma.webhookEvent.count({
                where: {
                    id: { in: ['evt_sem_assinatura', 'evt_inventado', 'evt_adulterado'] },
                },
            });

            expect(gravados).toBe(0);
        });

        it('aceita uma assinatura verdadeira', async () => {
            const response = await enviar(sessaoSemSubscricao(`evt_${marca}_ok`));

            expect(response.statusCode, response.body).toBe(200);
            expect(response.json().received).toBe(true);
        });
    });

    describe('o mesmo evento não é aplicado duas vezes', () => {
        const id = `evt_${marca}_repetido`;

        it('a primeira entrega é tratada', async () => {
            const response = await enviar(sessaoSemSubscricao(id));

            expect(response.statusCode, response.body).toBe(200);
            expect(response.json().outcome).toBe('ignored');
        });

        /**
         * O Stripe reenvia sempre que não recebe resposta a tempo. É o
         * PostgreSQL que recusa a segunda gravação, pela chave primária.
         */
        it('a segunda entrega é reconhecida como repetida', async () => {
            const response = await enviar(sessaoSemSubscricao(id));

            expect(response.statusCode, response.body).toBe(200);
            expect(response.json().outcome).toBe('duplicate');
        });

        it('só existe uma linha para o evento', async () => {
            const linhas = await prisma.webhookEvent.count({ where: { id } });

            expect(linhas).toBe(1);
        });

        /**
         * Duas entregas em paralelo é o caso que uma leitura antes da
         * escrita deixaria passar: ambas leriam "ainda não existe" e
         * ambas aplicariam. Só uma pode ganhar.
         */
        it('duas entregas ao mesmo tempo só contam uma vez', async () => {
            const emParalelo = `evt_${marca}_paralelo`;

            const [primeira, segunda] = await Promise.all([
                enviar(sessaoSemSubscricao(emParalelo)),
                enviar(sessaoSemSubscricao(emParalelo)),
            ]);

            const resultados = [
                primeira.json().outcome as string,
                segunda.json().outcome as string,
            ].sort();

            expect(resultados).toEqual(['duplicate', 'ignored']);

            const linhas = await prisma.webhookEvent.count({
                where: { id: emParalelo },
            });

            expect(linhas).toBe(1);
        });
    });

    /**
     * O Stripe envia dezenas de tipos. Reagir a um que não se entende é
     * pior do que não reagir — e responder com erro faria o Stripe
     * reenviá-lo indefinidamente.
     */
    describe('eventos que não interessam', () => {
        it('são aceites e ignorados, sem sequer serem gravados', async () => {
            const id = `evt_${marca}_irrelevante`;

            const response = await enviar({
                id,
                type: 'customer.created',
                data: { object: { id: 'cus_1' } },
            });

            expect(response.statusCode, response.body).toBe(200);
            expect(response.json().outcome).toBe('ignored');

            expect(await prisma.webhookEvent.count({ where: { id } })).toBe(0);
        });
    });
});
