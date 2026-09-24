import Fastify from 'fastify';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RouteOptions } from 'fastify';

import moderationRoutes from '../../src/modules/moderation/moderation.routes.js';
import validationPlugin from '../../src/plugins/http/validation.plugin.js';
import type { ModerationController } from '../../src/modules/moderation/controllers/moderation.controller.js';

/**
 * A fila de quem modera.
 *
 * Uma só para a plataforma inteira, e por isso **qualquer uma** das
 * duas permissões de moderação a abre. Exigir as duas fechava a porta a
 * quem só modera uma superfície; escolher uma delas obrigava a decidir
 * qual, sendo que a fila é a mesma.
 *
 * E nada aqui é público. A fila mostra texto que alguém achou mau o
 * suficiente para avisar, com o nome de quem avisou: é o contrário de
 * uma coisa para se ver de fora.
 */
describe('ligação das rotas da moderação', () => {
    const rotas = new Map<string, RouteOptions>();
    const quaisquerPorRota = new Map<string, string[]>();
    const exigidasPorRota = new Map<string, string[]>();

    beforeAll(async () => {
        const app = Fastify();

        await app.register(validationPlugin);

        app.decorate('authenticate', vi.fn() as never);

        const quaisquer = new Map<unknown, string[]>();
        const exigidas = new Map<unknown, string[]>();

        app.decorate('authorize', ((...permissoes: string[]) => {
            const handler = vi.fn();
            exigidas.set(handler, permissoes);
            return handler;
        }) as never);

        app.decorate('authorizeAny', ((...permissoes: string[]) => {
            const handler = vi.fn();
            quaisquer.set(handler, permissoes);
            return handler;
        }) as never);

        app.addHook('onRoute', (rota) => {
            rotas.set(`${rota.method as string} ${rota.url}`, rota);
        });

        const controller = {
            listReports: vi.fn(),
            handleReport: vi.fn(),
        } as unknown as ModerationController;

        await app.register(moderationRoutes, { controller });
        await app.ready();

        for (const [chave, rota] of rotas) {
            const preHandlers = rota.preHandler
                ? Array.isArray(rota.preHandler)
                    ? rota.preHandler
                    : [rota.preHandler]
                : [];

            quaisquerPorRota.set(
                chave,
                preHandlers.flatMap((handler) => quaisquer.get(handler) ?? []),
            );
            exigidasPorRota.set(
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

    it.each(['GET /reports', 'POST /reports/:reportId'])(
        '%s pede sessão',
        (chave) => {
            expect(preHandlersDe(chave)).toHaveLength(2);
        },
    );

    /**
     * Qualquer uma das duas, e não as duas: quem modera só o mercado
     * abre a mesma fila que quem modera só o fórum.
     */
    it.each(['GET /reports', 'POST /reports/:reportId'])(
        '%s aceita qualquer uma das permissões de moderar',
        (chave) => {
            expect(quaisquerPorRota.get(chave)).toEqual([
                'forum:moderate',
                'marketplace:moderate',
            ]);
        },
    );

    it.each(['GET /reports', 'POST /reports/:reportId'])(
        '%s não exige as duas ao mesmo tempo',
        (chave) => {
            expect(exigidasPorRota.get(chave)).toEqual([]);
        },
    );

    /**
     * Ler a fila não leva limite, como nenhuma leitura leva: um
     * moderador a percorrer denúncias depressa está a trabalhar, e um
     * limite aqui dava-lhe um erro por isso.
     */
    it.each(['GET /reports', 'POST /reports/:reportId'])(
        '%s não leva limite de escrita',
        (chave) => {
            expect(rotas.get(chave)?.config).toBeUndefined();
        },
    );

    it('valida o que lhe chega', () => {
        expect(rotas.get('GET /reports')?.schema?.querystring).toBeDefined();
        expect(rotas.get('POST /reports/:reportId')?.schema?.params).toBeDefined();
        expect(rotas.get('POST /reports/:reportId')?.schema?.body).toBeDefined();
    });
});
