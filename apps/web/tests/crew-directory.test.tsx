import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CrewDirectoryPage } from '../src/crews/pages/crew-directory.page.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const pagina = {
    items: [
        {
            id: 'crew-1',
            name: 'Vice Kings',
            tag: 'VICE',
            description: null,
            level: 4,
            memberCount: 3,
            isPremium: false,
            appearance: { bannerUrl: null, accentColor: null },
            createdAt: '2026-01-01T00:00:00.000Z',
        },
    ],
    featured: [],
    page: 1,
    totalPages: 1,
    total: 1,
};

/** As URL por que o diretório passou, por ordem. */
const enderecos = (fetchMock: ReturnType<typeof vi.fn>): string[] =>
    fetchMock.mock.calls.map((argumentos) => String(argumentos[0]));

afterEach(() => {
    vi.unstubAllGlobals();
});

/**
 * O diretório de crews.
 *
 * A API ordena por nível desde sempre e o ecrã nunca lho pedia: mostrava
 * a ordem por omissão e mais nada. O que aqui se prova é que a escolha
 * chega mesmo à API — um seletor que muda o estado e não muda o pedido
 * seria um seletor a fingir.
 */
describe('ordenar o diretório', () => {
    const montar = () => montarEcra(<CrewDirectoryPage />);

    it('começa pela ordem por omissão', async () => {
        const fetchMock = vi.fn(() => Promise.resolve(json(200, pagina)));

        vi.stubGlobal('fetch', fetchMock);
        montar();

        await waitFor(() => {
            expect(screen.getByText('Vice Kings')).toBeDefined();
        });

        expect(enderecos(fetchMock)[0]).toContain('sort=newest');
    });

    it('pede à API a ordem escolhida', async () => {
        const fetchMock = vi.fn(() => Promise.resolve(json(200, pagina)));

        vi.stubGlobal('fetch', fetchMock);
        montar();

        await waitFor(() => {
            expect(screen.getByText('Vice Kings')).toBeDefined();
        });

        await userEvent.selectOptions(
            screen.getByLabelText(t.crews.ordenarPor),
            'level',
        );

        await waitFor(() => {
            expect(
                enderecos(fetchMock).some((url) => url.includes('sort=level')),
            ).toBe(true);
        });
    });

    /**
     * Continuar na página 4 de outra ordenação é olhar para um sítio que
     * já não quer dizer o mesmo.
     */
    it('volta à primeira página ao mudar de ordem', async () => {
        const fetchMock = vi.fn(() =>
            Promise.resolve(json(200, { ...pagina, page: 2, totalPages: 3 })),
        );

        vi.stubGlobal('fetch', fetchMock);
        montar();

        await waitFor(() => {
            expect(screen.getByText('Vice Kings')).toBeDefined();
        });

        await userEvent.click(
            screen.getByRole('button', { name: t.crews.seguinte }),
        );

        await waitFor(() => {
            expect(
                enderecos(fetchMock).some((url) => url.includes('page=2')),
            ).toBe(true);
        });

        await userEvent.selectOptions(
            screen.getByLabelText(t.crews.ordenarPor),
            'name',
        );

        await waitFor(() => {
            const ultimo = enderecos(fetchMock).at(-1) ?? '';

            expect(ultimo).toContain('sort=name');
            expect(ultimo).not.toContain('page=2');
        });
    });
});
