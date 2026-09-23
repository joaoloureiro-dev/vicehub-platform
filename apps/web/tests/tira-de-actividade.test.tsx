import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { TiraDeActividade } from '../src/servers/components/tira-de-actividade.js';
import { montarEcra, t } from './helpers.js';

/**
 * A tira no ecrã.
 *
 * O que aqui se guarda não é o desenho — é o que o desenho promete:
 * que um servidor que nunca reportou não mostra um gráfico vazio com
 * ar de avaria, e que os números que se leem de relance estão em texto
 * e não só na forma das barras.
 */
const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const horaAtras = (horas: number): string => {
    const quando = new Date(Date.now() - horas * 60 * 60 * 1000);

    quando.setUTCMinutes(0, 0, 0);

    return quando.toISOString();
};

const responder = (corpo: unknown, status = 200) => {
    const chamadas = vi.fn((url: string) => {
        const endereco = String(url);

        if (endereco.includes('/activity')) {
            return Promise.resolve(json(status, corpo));
        }

        throw new Error(`rota não prevista no duplo: ${endereco}`);
    });

    vi.stubGlobal('fetch', chamadas);

    return chamadas;
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('a tira de atividade', () => {
    it('mostra a média e o pico em texto, e não só no gráfico', async () => {
        responder({
            hours: [
                { hour: horaAtras(2), samples: 12, average: 8, peak: 11, last: 9 },
                { hour: horaAtras(1), samples: 12, average: 20, peak: 30, last: 25 },
            ],
            average: 14,
            peak: 30,
        });

        montarEcra(<TiraDeActividade serverId="s1" />);

        expect(await screen.findByText('14')).toBeDefined();
        expect(screen.getByText('30')).toBeDefined();
        expect(screen.getByText(t.servidores.mediaDeSete)).toBeDefined();
    });

    /**
     * Uma série só: o título diz o que é, e uma legenda com um item
     * seria uma caixa a explicar a única cor que há.
     */
    it('dá à tira um nome que um leitor de ecrã encontra', async () => {
        responder({
            hours: [
                { hour: horaAtras(1), samples: 6, average: 4, peak: 5, last: 4 },
            ],
            average: 4,
            peak: 5,
        });

        montarEcra(<TiraDeActividade serverId="s1" />);

        const tira = await screen.findByRole('img');

        expect(tira.getAttribute('aria-label')).toContain('4');
        expect(tira.getAttribute('aria-label')).toContain('5');
    });

    /**
     * O eixo tem sempre as suas horas, mesmo as que ninguém reportou —
     * e as vazias distinguem-se das barras.
     */
    it('desenha as horas todas, com as vazias marcadas como tal', async () => {
        responder({
            hours: [
                { hour: horaAtras(1), samples: 6, average: 4, peak: 5, last: 4 },
            ],
            average: 4,
            peak: 5,
        });

        const { container } = montarEcra(<TiraDeActividade serverId="s1" />);

        await waitFor(() => {
            expect(container.querySelectorAll('.tira .casa').length).toBe(48);
        });

        /** Uma com dados, quarenta e sete sem. */
        expect(container.querySelectorAll('.tira .casa.vazia').length).toBe(47);
        expect(container.querySelectorAll('.tira .barra').length).toBe(1);
    });

    /**
     * Um servidor que nunca reportou não leva um gráfico de quarenta e
     * oito casas em branco: isso parece uma avaria, e o que se passa é
     * que ninguém instalou o recurso.
     */
    it('não desenha nada quando não há passado nenhum', async () => {
        const chamadas = responder({ hours: [], average: 0, peak: 0 });

        const { container } = montarEcra(<TiraDeActividade serverId="s1" />);

        await waitFor(() => {
            expect(chamadas).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(container.querySelector('.tira')).toBeNull();
        });

        expect(screen.queryByText(t.servidores.actividadeTitulo)).toBeNull();
    });

    /** E um erro da API também não: o perfil continua a servir sem isto. */
    it('desaparece em silêncio quando a API recusa', async () => {
        responder({ code: 'BOOM' }, 500);

        const { container } = montarEcra(<TiraDeActividade serverId="s1" />);

        await waitFor(() => {
            expect(container.querySelector('.tira')).toBeNull();
        });

        expect(screen.queryByText(t.servidores.actividadeTitulo)).toBeNull();
    });
});
