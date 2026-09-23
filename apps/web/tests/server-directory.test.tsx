import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ServerDirectoryPage } from '../src/servers/pages/server-directory.page.js';
import { montarEcra, t } from './helpers.js';

/**
 * O diretório de servidores, e a ordem por que mostra as coisas.
 *
 * Duas decisões vivem aqui e não se veem a olhar para o ecrã: **a
 * ordem por omissão são os mais recentes**, e o número por que a outra
 * ordem ordena **está à vista**. A primeira é o que impede o diretório
 * de ser uma lista onde os grandes estão sempre em cima e um servidor
 * novo nunca é visto; a segunda é o que permite a quem estranha a
 * ordem conferi-la.
 */
const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const servidor = (nome: string, media: number | null) => ({
    id: `s-${nome}`,
    name: nome,
    region: 'EU',
    description: null,
    joinRequirements: null,
    isOnline: true,
    playersOnline: 5,
    playersAverage: media,
    memberCount: 3,
    isPremium: false,
    appearance: { bannerUrl: null, accentColor: null },
    createdAt: '2026-09-20T10:00:00.000Z',
});

const responder = (itens = [servidor('Vice City', 42)]) => {
    const chamadas = vi.fn((url: string) => {
        const endereco = String(url);

        if (endereco.includes('/servers')) {
            return Promise.resolve(
                json(200, {
                    items: itens,
                    featured: [],
                    page: 1,
                    pages: 1,
                    total: itens.length,
                }),
            );
        }

        throw new Error(`rota não prevista no duplo: ${endereco}`);
    });

    vi.stubGlobal('fetch', chamadas);

    return chamadas;
};

const enderecoDe = (chamadas: ReturnType<typeof vi.fn>): string[] =>
    chamadas.mock.calls.map(([url]) => String(url));

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('o diretório de servidores', () => {
    /**
     * A ordem por omissão são os mais recentes, e é deliberado: por
     * atividade, os grandes estavam sempre em cima e um servidor novo
     * nunca era visto — o que garantiria que continuava sem ninguém.
     */
    it('pede os mais recentes por omissão', async () => {
        const chamadas = responder();

        montarEcra(<ServerDirectoryPage />);

        await waitFor(() => {
            expect(enderecoDe(chamadas).some((url) => url.includes('sort=newest')))
                .toBe(true);
        });

        expect(enderecoDe(chamadas).some((url) => url.includes('sort=active')))
            .toBe(false);
    });

    it('passa a pedir por atividade quando se escolhe essa ordem', async () => {
        const chamadas = responder();

        montarEcra(<ServerDirectoryPage />);

        await screen.findByText('Vice City');

        await userEvent.click(screen.getByText(t.servidores.ordens.active));

        await waitFor(() => {
            expect(enderecoDe(chamadas).some((url) => url.includes('sort=active')))
                .toBe(true);
        });
    });

    /**
     * O número por que a lista ordena, à vista. Uma lista ordenada por
     * um número invisível é uma lista que ninguém consegue conferir.
     */
    it('mostra a média de cada servidor', async () => {
        responder();

        montarEcra(<ServerDirectoryPage />);

        expect(await screen.findByText(t.servidores.mediaDe(42))).toBeDefined();
    });

    /**
     * Um servidor sem passado não mostra "0 em média": zero pessoas e
     * nenhum dado são coisas diferentes, e dizer a primeira quando é a
     * segunda é afirmar uma coisa que ninguém mediu.
     */
    it('não inventa um zero para quem não tem passado', async () => {
        responder([servidor('Recém-chegado', null)]);

        montarEcra(<ServerDirectoryPage />);

        await screen.findByText('Recém-chegado');

        expect(screen.queryByText(t.servidores.mediaDe(0))).toBeNull();
    });
});
