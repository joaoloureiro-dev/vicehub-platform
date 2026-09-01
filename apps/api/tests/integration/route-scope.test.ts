import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance, RouteOptions } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * O âmbito das permissões tem de sobreviver à validação dos parâmetros.
 *
 * O guard de autorização lê o âmbito de `request.params.crewId` e
 * `request.params.serverId`. O Zod, por omissão, **descarta o que o
 * schema não declara**. Uma rota como
 * `/crews/:crewId/:eventId` cujo schema de parâmetros só declare o
 * `eventId` fica sem `crewId` no momento em que o guard corre: a
 * permissão passa a ser avaliada sem âmbito nenhum, e quem manda na
 * crew vê a própria rota recusada.
 *
 * É uma armadilha silenciosa — o schema parece correto, a rota parece
 * correta, e só um pedido a sério a revela. Este teste fecha-a para
 * todas as rotas de uma vez, incluindo as que ainda não existem.
 */
describe('parâmetros de âmbito', () => {
    let app: FastifyInstance;

    const rotas: RouteOptions[] = [];

    beforeAll(async () => {
        app = buildApp();

        app.addHook('onRoute', (route) => {
            rotas.push(route);
        });

        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    /**
     * Os parâmetros de âmbito que o guard de autorização conhece.
     */
    const AMBITOS = ['crewId', 'serverId'] as const;

    interface Suspeita {
        rota: string;
        parametro: string;
    }

    const comEsquemaDeParametros = (): Suspeita[] => {
        const suspeitas: Suspeita[] = [];

        for (const rota of rotas) {
            const params = rota.schema?.params;

            if (!params) {
                continue;
            }

            for (const ambito of AMBITOS) {
                if (rota.url.includes(`:${ambito}`)) {
                    suspeitas.push({ rota: `${rota.method as string} ${rota.url}`, parametro: ambito });
                }
            }
        }

        return suspeitas;
    };

    it('há rotas com âmbito e schema de parâmetros para verificar', () => {
        expect(comEsquemaDeParametros().length).toBeGreaterThan(0);
    });

    /**
     * O schema é aplicado a um objeto que traz o âmbito preenchido. Se o
     * resultado o perder, a rota está a desarmar o próprio guard.
     */
    it('nenhum schema de parâmetros descarta o âmbito da rota', () => {
        const perdidos: string[] = [];

        for (const rota of rotas) {
            const params = rota.schema?.params as
                | { parse?: (value: unknown) => unknown }
                | undefined;

            if (!params || typeof params.parse !== 'function') {
                continue;
            }

            for (const ambito of AMBITOS) {
                if (!rota.url.includes(`:${ambito}`)) {
                    continue;
                }

                /**
                 * Um objeto com todos os parâmetros da rota preenchidos
                 * com uuids: o que interessa é o que sai, não o que
                 * entra.
                 */
                const entrada: Record<string, string> = {};

                for (const segmento of rota.url.split('/')) {
                    if (segmento.startsWith(':')) {
                        entrada[segmento.slice(1)] =
                            '00000000-0000-4000-8000-000000000000';
                    }
                }

                let saida: Record<string, unknown>;

                try {
                    saida = params.parse(entrada) as Record<string, unknown>;
                } catch {
                    /**
                     * Um schema pode recusar o uuid de exemplo por o
                     * parâmetro ter outro formato — o `:username`, por
                     * exemplo. Aí não há nada a dizer sobre o âmbito.
                     */
                    continue;
                }

                if (saida[ambito] === undefined) {
                    perdidos.push(
                        `${rota.method as string} ${rota.url} perde o ${ambito}`,
                    );
                }
            }
        }

        expect(perdidos).toEqual([]);
    });

});
