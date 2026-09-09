import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { Feed } from '../src/pages/feed.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const crew = { id: 'crew-1', name: 'Vice Kings', tag: 'VICE' };

const servir = (itens: unknown) => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(200, itens))));
};

afterEach(() => {
    vi.unstubAllGlobals();
});

/**
 * O feed.
 *
 * Cada linha é uma coisa que já se podia ver navegando, e por isso leva
 * links: a pergunta seguinte a "a crew ganhou xp" é sempre "qual, e de
 * que evento?".
 */
describe('o que aconteceu', () => {
    it('mostra um evento concluído, com a crew e o evento a linkar', async () => {
        servir([
            {
                kind: 'crew_event',
                id: 'xp-1',
                at: '2026-02-02T20:00:00.000Z',
                crew,
                event: { id: 'evento-1', name: 'Assalto ao banco' },
                amount: 100,
            },
        ]);

        montarEcra(<Feed />);

        await waitFor(() => {
            expect(
                screen.getByRole('link', { name: 'Assalto ao banco' }),
            ).toBeDefined();
        });

        expect(screen.getByRole('link', { name: 'Vice Kings' })).toBeDefined();
        expect(screen.getByText(t.feed.eventoFeito(100))).toBeDefined();
    });

    /**
     * Apagar um evento não apaga o que ele deu — mas deixa de haver para
     * onde apontar, e um link partido é pior do que texto.
     */
    it('aguenta um evento que já não existe', async () => {
        servir([
            {
                kind: 'crew_event',
                id: 'xp-2',
                at: '2026-02-01T20:00:00.000Z',
                crew,
                event: null,
                amount: 75,
            },
        ]);

        montarEcra(<Feed />);

        await waitFor(() => {
            expect(screen.getByText(t.feed.eventoFeito(75))).toBeDefined();
        });

        expect(screen.getAllByRole('link')).toHaveLength(1);
    });

    it('mostra quem entrou numa crew', async () => {
        servir([
            {
                kind: 'crew_joined',
                id: 'm-1',
                at: '2026-02-03T10:00:00.000Z',
                crew,
                person: { id: 'u-2', username: 'bruno' },
            },
        ]);

        montarEcra(<Feed />);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: 'bruno' })).toBeDefined();
        });

        expect(screen.getByText(t.feed.entrouEm)).toBeDefined();
    });

    /**
     * Um feed vazio sem explicação parece uma coisa avariada. O que se
     * passa é apenas que ainda não aconteceu nada.
     */
    it('sem nada, diz o que fazer para passar a haver', async () => {
        servir([]);

        montarEcra(<Feed />);

        await waitFor(() => {
            expect(screen.getByText(t.feed.aindaNada)).toBeDefined();
        });
    });

    it('diz que não carregou em vez de ficar em branco', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(json(500, { message: 'boom' }))),
        );

        montarEcra(<Feed />);

        expect((await screen.findByRole('alert')).textContent).toBe(
            t.feed.naoCarregou,
        );
    });
});
