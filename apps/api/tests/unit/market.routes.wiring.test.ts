import Fastify from 'fastify';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RouteOptions } from 'fastify';

import marketRoutes from '../../src/modules/market/market.routes.js';
import validationPlugin from '../../src/plugins/http/validation.plugin.js';
import type { MarketController } from '../../src/modules/market/controllers/market.controller.js';

/**
 * Quem pode o quê no mercado, e o que custa anunciar.
 *
 * Três decisões que não se veem a olhar para um handler e que
 * desaparecem sem ruído nenhum — basta alguém copiar uma rota e
 * esquecer uma linha:
 *
 * - **ler é público**, porque quem está a escolher onde jogar ainda não
 *   tem conta, e o mercado de um servidor é a prova mais direta de que
 *   a economia dele está viva;
 * - **anunciar pede sessão e permissão**, separadas, para se poder
 *   calar alguém sem lhe apagar a conta;
 * - **criar tem limite e editar não**, porque quem baixa o preço três
 *   vezes numa tarde está a vender e não a inundar nada.
 */
describe('ligação das rotas do mercado', () => {
    const rotas = new Map<string, RouteOptions>();
    const permissoesPorRota = new Map<string, string[]>();

    beforeAll(async () => {
        const app = Fastify();

        await app.register(validationPlugin);

        app.decorate('authenticate', vi.fn() as never);

        const exigidas = new Map<unknown, string[]>();

        app.decorate('authorize', ((...permissoes: string[]) => {
            const handler = vi.fn();
            exigidas.set(handler, permissoes);
            return handler;
        }) as never);

        app.addHook('onRoute', (rota) => {
            rotas.set(`${rota.method as string} ${rota.url}`, rota);
        });

        const controller = {
            list: vi.fn(),
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            close: vi.fn(),
            remove: vi.fn(),
            report: vi.fn(),
        } as unknown as MarketController;

        await app.register(marketRoutes, { controller });
        await app.ready();

        /**
         * As permissões ficam guardadas por rota depois de as rotas
         * estarem todas registadas, para o mapa das exigidas já estar
         * cheio quando se lê.
         */
        for (const [chave, rota] of rotas) {
            const preHandlers = rota.preHandler
                ? Array.isArray(rota.preHandler)
                    ? rota.preHandler
                    : [rota.preHandler]
                : [];

            permissoesPorRota.set(
                chave,
                preHandlers.flatMap((handler) => exigidas.get(handler) ?? []),
            );
        }
    });

    const preHandlersDe = (chave: string) => {
        const rota = rotas.get(chave);

        expect(rota, `a rota ${chave} não existe`).toBeDefined();

        const preHandler = (rota as RouteOptions).preHandler;

        if (!preHandler) {
            return [];
        }

        return Array.isArray(preHandler) ? preHandler : [preHandler];
    };

    const limiteDe = (chave: string) =>
        (rotas.get(chave)?.config as
            | { rateLimit?: { max?: number; timeWindow?: string } }
            | undefined)?.rateLimit;

    it.each([
        'GET /servers/:serverId/listings',
        'GET /listings/:listingId',
    ])('%s não pede sessão', (chave) => {
        expect(preHandlersDe(chave)).toHaveLength(0);
    });

    it.each([
        'POST /servers/:serverId/listings',
        'PATCH /listings/:listingId',
        'POST /listings/:listingId/close',
        'DELETE /listings/:listingId',
        'POST /listings/:listingId/reports',
    ])('%s pede sessão e a permissão de anunciar', (chave) => {
        expect(preHandlersDe(chave)).toHaveLength(2);
        expect(permissoesPorRota.get(chave)).toEqual(['marketplace:post']);
    });

    /**
     * O limite é de quem cria, e de mais ninguém.
     *
     * Aplicá-lo a editar castigava o uso normal — o anúncio continua a
     * ser um —, e não o aplicar a criar deixava uma conta com um guião
     * a encher o mercado de um servidor numa tarde.
     */
    it.each([
        'POST /servers/:serverId/listings',
        'POST /listings/:listingId/reports',
    ])('%s leva limite de escrita', (chave) => {
        const limite = limiteDe(chave);

        expect(limite?.max).toBeGreaterThan(0);
        expect(limite?.timeWindow).toBeTruthy();
    });

    /**
     * Retirar exige a permissão de anunciar, e não a de moderar.
     *
     * Quem pode retirar **este** anúncio decide-se no serviço: o dono,
     * sempre, e quem modera. Exigir a permissão de moderação à entrada
     * fechava a porta a quem quer apagar o que ele próprio anunciou.
     */
    it('retirar não exige a permissão de moderar', () => {
        expect(permissoesPorRota.get('DELETE /listings/:listingId')).toEqual([
            'marketplace:post',
        ]);
    });

    it.each([
        'PATCH /listings/:listingId',
        'POST /listings/:listingId/close',
        'DELETE /listings/:listingId',
        'GET /servers/:serverId/listings',
        'GET /listings/:listingId',
    ])('%s não leva limite de escrita', (chave) => {
        expect(limiteDe(chave)).toBeUndefined();
    });
});
