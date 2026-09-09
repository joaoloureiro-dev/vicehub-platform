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
            isRecruiting: false,
            recruitingSince: null,
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
/** A mesma página, mas com uma crew que anunciou que recruta. */
const paginaComRecruta = {
    ...pagina,
    items: [
        {
            ...pagina.items[0],
            id: 'crew-2',
            name: 'Leonida Boys',
            isRecruiting: true,
            recruitingSince: '2026-08-01T00:00:00.000Z',
        },
    ],
};

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

/**
 * O quadro de recrutamento é o mesmo ecrã com o filtro ligado.
 *
 * O que se prova aqui é que o filtro **chega à API**. Um ecrã que muda de
 * título e pede a mesma lista de sempre seria um quadro a fingir — e o
 * pior tipo de erro, porque parece funcionar: aparecem crews, só que as
 * erradas.
 */
describe('o quadro de recrutamento', () => {
    it('pede à API só as crews que recrutam', async () => {
        const fetchMock = vi.fn(() =>
            Promise.resolve(json(200, paginaComRecruta)),
        );

        vi.stubGlobal('fetch', fetchMock);
        montarEcra(<CrewDirectoryPage apenasRecrutamento />);

        await waitFor(() => {
            expect(screen.getByText('Leonida Boys')).toBeDefined();
        });

        expect(enderecos(fetchMock)[0]).toContain('recruiting=true');
    });

    /**
     * E o diretório normal continua a não o pedir. Sem este caso, o de
     * cima passava com o filtro ligado sempre — e o diretório mostrava
     * só quem recruta, que é exatamente o contrário do que ele é.
     */
    it('o diretório normal não pede o filtro', async () => {
        const fetchMock = vi.fn(() => Promise.resolve(json(200, pagina)));

        vi.stubGlobal('fetch', fetchMock);
        montarEcra(<CrewDirectoryPage />);

        await waitFor(() => {
            expect(screen.getByText('Vice Kings')).toBeDefined();
        });

        expect(enderecos(fetchMock)[0]).not.toContain('recruiting');
    });

    it('marca no cartão quem está a recrutar', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(json(200, paginaComRecruta))),
        );

        montarEcra(<CrewDirectoryPage apenasRecrutamento />);

        expect(await screen.findByText(t.crews.recruta)).toBeDefined();
    });

    /**
     * A marca sai do que a API diz sobre cada crew, e não do ecrã em que
     * o cartão está. Uma crew que não recruta não passa a recrutar por
     * aparecer numa lista qualquer.
     */
    it('não marca quem não recruta', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(json(200, pagina))),
        );

        montarEcra(<CrewDirectoryPage />);

        await waitFor(() => {
            expect(screen.getByText('Vice Kings')).toBeDefined();
        });

        expect(screen.queryByText(t.crews.recruta)).toBeNull();
    });
});
