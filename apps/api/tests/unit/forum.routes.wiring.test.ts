import Fastify from 'fastify';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RouteOptions } from 'fastify';

import forumRoutes from '../../src/modules/forum/forum.routes.js';
import validationPlugin from '../../src/plugins/http/validation.plugin.js';
import type { ForumController } from '../../src/modules/forum/controllers/forum.controller.js';

/**
 * Quem pode o quê no fórum, e o que custa escrever.
 *
 * O fórum é a única superfície da plataforma onde qualquer pessoa
 * registada deixa texto à vista de toda a gente. Duas decisões
 * sustentam-no, e nenhuma delas se vê a olhar para um handler:
 *
 * - **ler é público** e escrever não é;
 * - **escrever tem um limite próprio**, muito mais apertado do que o
 *   global, senão uma conta com um guião enche o fórum mais depressa do
 *   que alguém o limpa.
 *
 * As duas desaparecem sem ruído nenhum — basta alguém copiar uma rota e
 * esquecer uma linha. Por isso ficam aqui.
 */
describe('ligação das rotas do fórum', () => {
    const rotas = new Map<string, RouteOptions>();
    const permissoesPorRota = new Map<string, string[]>();

    beforeAll(async () => {
        const app = Fastify();

        await app.register(validationPlugin);

        app.decorate('authenticate', vi.fn() as never);

        /**
         * O `authorize` devolve um preHandler; guardamos as permissões
         * que cada rota exigiu, para se poder verificar quais são.
         */
        const exigidas = new Map<unknown, string[]>();

        app.decorate('authorize', ((...permissoes: string[]) => {
            const handler = vi.fn();
            exigidas.set(handler, permissoes);
            return handler;
        }) as never);

        app.addHook('onRoute', (rota) => {
            const chave = `${rota.method as string} ${rota.url}`;
            rotas.set(chave, rota);

            const preHandlers = rota.preHandler
                ? Array.isArray(rota.preHandler)
                    ? rota.preHandler
                    : [rota.preHandler]
                : [];

            permissoesPorRota.set(
                chave,
                preHandlers.flatMap((handler) => exigidas.get(handler) ?? []),
            );
        });

        const controller = {
            list: vi.fn(),
            get: vi.fn(),
            create: vi.fn(),
            reply: vi.fn(),
            removeTopic: vi.fn(),
            removeReply: vi.fn(),
        } as unknown as ForumController;

        await app.register(forumRoutes, { controller });
        await app.ready();
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

    /**
     * Ler é público, e é a decisão que faz o fórum valer a pena: uma
     * pergunta respondida serve sobretudo quem chega de uma pesquisa sem
     * conta nenhuma.
     */
    it.each(['GET /topics', 'GET /topics/:topicId'])(
        '%s não pede sessão',
        (chave) => {
            expect(preHandlersDe(chave)).toHaveLength(0);
        },
    );

    /**
     * Escrever pede sessão **e** permissão. São duas coisas e não uma: o
     * dia em que for preciso calar alguém sem lhe apagar a conta,
     * tira-se-lhe a permissão.
     */
    it.each([
        'POST /topics',
        'POST /topics/:topicId/replies',
        'DELETE /topics/:topicId',
        'DELETE /replies/:replyId',
    ])('%s pede sessão e permissão', (chave) => {
        expect(preHandlersDe(chave)).toHaveLength(2);
        expect(permissoesPorRota.get(chave)).toEqual(['forum:post']);
    });

    /**
     * Retirar exige `forum:post` e **não** `forum:moderate`.
     *
     * Quem pode retirar este tópico decide-se no serviço: quem o
     * escreveu, sempre, e quem modera. Exigir a moderação à entrada
     * fechava a porta a quem quer apagar o que ele próprio escreveu, que
     * é o caso mais comum de todos.
     */
    it.each(['DELETE /topics/:topicId', 'DELETE /replies/:replyId'])(
        '%s não exige a permissão de moderar',
        (chave) => {
            expect(permissoesPorRota.get(chave)).not.toContain('forum:moderate');
        },
    );

    /**
     * E escrever leva um limite próprio, mais apertado do que o global.
     */
    it.each(['POST /topics', 'POST /topics/:topicId/replies'])(
        '%s leva um limite de escrita próprio',
        (chave) => {
            const limite = limiteDe(chave);

            expect(limite?.max).toBeGreaterThan(0);
            /** O global permite cem por minuto. */
            expect(limite?.max).toBeLessThan(100);
            expect(limite?.timeWindow).toBeTruthy();
        },
    );

    /**
     * Ler não leva limite próprio. Uma pessoa a navegar depressa por um
     * fórum não está a abusar de nada, e um limite aqui dava-lhe um erro
     * por ler.
     */
    it.each(['GET /topics', 'GET /topics/:topicId'])(
        '%s não leva limite próprio',
        (chave) => {
            expect(limiteDe(chave)).toBeUndefined();
        },
    );

    /** E tudo o que entra é validado antes de chegar ao handler. */
    it.each([
        ['POST /topics', 'body'],
        ['POST /topics/:topicId/replies', 'body'],
        ['GET /topics/:topicId', 'params'],
        ['DELETE /replies/:replyId', 'params'],
    ])('%s valida o %s do pedido', (chave, parte) => {
        const schema = rotas.get(chave)?.schema as
            | Record<string, unknown>
            | undefined;

        expect(schema?.[parte]).toBeDefined();
    });
});
