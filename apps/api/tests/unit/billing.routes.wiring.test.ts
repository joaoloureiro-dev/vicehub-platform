import Fastify from 'fastify';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RouteOptions } from 'fastify';

import billingRoutes from '../../src/modules/billing/billing.routes.js';
import validationPlugin from '../../src/plugins/http/validation.plugin.js';
import type { BillingController } from '../../src/modules/billing/controllers/billing.controller.js';

/**
 * Que rotas da cobrança estão abertas, e por que razão.
 *
 * Duas delas são públicas de propósito, e por razões opostas: o catálogo
 * porque um preço é para ser visto antes de haver conta, e o webhook
 * porque quem o chama é o Stripe, que conta não tem. O que separa as
 * duas do resto é isto ficar escrito — uma terceira rota aberta por
 * descuido não se distingue destas ao olhar para o ficheiro.
 */
describe('ligação das rotas da cobrança', () => {
    const registadas = new Map<string, RouteOptions>();

    beforeAll(async () => {
        const app = Fastify();

        await app.register(validationPlugin);

        app.decorate('authenticate', vi.fn() as never);

        app.addHook('onRoute', (route) => {
            registadas.set(`${route.method as string} ${route.url}`, route);
        });

        const controller = {
            listPlans: vi.fn(),
            startCheckout: vi.fn(),
            handleWebhook: vi.fn(),
        } as unknown as BillingController;

        await app.register(billingRoutes, { controller });
        await app.ready();
        await app.close();
    });

    const guardas = (key: string): number => {
        const rota = registadas.get(key);

        expect(rota, `rota ${key} não registada`).toBeDefined();

        const preHandler = rota?.preHandler;

        if (!preHandler) {
            return 0;
        }

        return Array.isArray(preHandler) ? preHandler.length : 1;
    };

    /**
     * Comprometer alguém — ou uma crew — a uma cobrança recorrente exige
     * saber quem está a pedir. Sem sessão, esta rota seria uma forma de
     * pôr outra pessoa a pagar.
     */
    it('a compra exige conta', () => {
        expect(guardas('POST /checkout')).toBe(1);
    });

    it('o catálogo é público', () => {
        expect(guardas('GET /plans')).toBe(0);
    });

    /**
     * O Stripe não tem conta nesta plataforma. O que protege esta rota é
     * a assinatura do evento, verificada antes de qualquer leitura do
     * conteúdo — sem ela seria uma forma pública de conceder planos.
     */
    it('o webhook é público, e não por descuido', () => {
        expect(guardas('POST /webhook')).toBe(0);
    });

    /**
     * A lista fecha-se de propósito. Uma rota nova que apareça aberta
     * cai aqui em vez de passar despercebida.
     */
    it('não há mais rotas abertas do que estas duas', () => {
        const abertas = [...registadas.keys()].filter(
            (key) => guardas(key) === 0,
        );

        expect(abertas.sort()).toEqual([
            'GET /plans',
            'HEAD /plans',
            'POST /webhook',
        ]);
    });

    /**
     * A assinatura do Stripe cobre os bytes tal como chegaram. Um schema
     * de corpo aqui fá-los-ia passar pelo Zod, que devolve um objeto novo
     * — e a verificação passaria a recusar eventos verdadeiros.
     */
    it('o webhook não declara schema de corpo', () => {
        expect(registadas.get('POST /webhook')?.schema?.body).toBeUndefined();
    });

    it('a compra valida o corpo antes de chegar ao serviço', () => {
        expect(registadas.get('POST /checkout')?.schema?.body).toBeDefined();
    });
});
