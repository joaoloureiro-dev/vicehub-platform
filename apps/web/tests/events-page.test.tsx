import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

import { EventsPage } from '../src/events/pages/events.page.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

/**
 * Responde ao calendário com o que o caso quiser, e a tudo o resto com
 * o que uma criação devolve. Cada rota é nomeada de propósito.
 */
const servir = (eventos: unknown[] = []) =>
    vi.fn((url: string, init?: { method?: string }) => {
        if (init?.method === 'POST') {
            return Promise.resolve(json(201, { id: 'ev-novo' }));
        }

        if (String(url).includes('/events/crews/')) {
            return Promise.resolve(json(200, eventos));
        }

        throw new Error(`rota não prevista pelo duplo: ${String(url)}`);
    });

const corpoDoPost = (fetchMock: ReturnType<typeof vi.fn>): unknown => {
    const chamada = fetchMock.mock.calls.find(
        (argumentos) =>
            (argumentos[1] as { method?: string } | undefined)?.method === 'POST',
    );

    return JSON.parse(
        String((chamada?.[1] as { body?: string } | undefined)?.body ?? '{}'),
    );
};

const montar = () =>
    montarEcra(
        <Routes>
            <Route path="/crews/:crewId/eventos" element={<EventsPage />} />
        </Routes>,
        '/crews/crew-1/eventos',
    );

afterEach(() => {
    vi.unstubAllGlobals();
});

/**
 * Marcar um evento e decidir quem o pode ver são duas coisas, e a
 * segunda tem um valor por omissão que é a decisão toda: **o evento é
 * da comunidade e de mais ninguém até alguém dizer o contrário**.
 */
describe('marcar um evento', () => {
    it('começa com a montra desligada', async () => {
        vi.stubGlobal('fetch', servir());

        montar();

        const caixa = (await screen.findByLabelText(
            t.eventos.porNaMontra,
        )) as HTMLInputElement;

        expect(caixa.checked).toBe(false);
    });

    /**
     * Não basta a caixa começar desmarcada: o que vai no pedido é que
     * decide. Um formulário que mandasse `isPublic: true` por engano
     * publicava o calendário de quem nunca o pediu.
     */
    it('sem lhe tocar, o evento não vai para a montra', async () => {
        const fetchMock = servir();
        vi.stubGlobal('fetch', fetchMock);

        montar();

        await userEvent.type(
            await screen.findByLabelText(t.eventos.nome),
            'Assalto ao banco',
        );
        await userEvent.type(
            screen.getByLabelText(t.eventos.comeca),
            '2026-12-24T21:00',
        );
        await userEvent.click(
            screen.getByRole('button', { name: t.eventos.marcar }),
        );

        await waitFor(() => {
            expect(corpoDoPost(fetchMock)).toMatchObject({ isPublic: false });
        });
    });

    it('marcada, o evento vai para a montra', async () => {
        const fetchMock = servir();
        vi.stubGlobal('fetch', fetchMock);

        montar();

        await userEvent.type(
            await screen.findByLabelText(t.eventos.nome),
            'Assalto ao banco',
        );
        await userEvent.type(
            screen.getByLabelText(t.eventos.comeca),
            '2026-12-24T21:00',
        );
        await userEvent.click(screen.getByLabelText(t.eventos.porNaMontra));
        await userEvent.click(
            screen.getByRole('button', { name: t.eventos.marcar }),
        );

        await waitFor(() => {
            expect(corpoDoPost(fetchMock)).toMatchObject({ isPublic: true });
        });
    });

    /**
     * A caixa volta ao fim. Marcar um evento não é dizer nada sobre o
     * seguinte, e um formulário que guardasse a escolha publicava o
     * próximo sem ninguém decidir.
     */
    it('a caixa não fica marcada para o evento seguinte', async () => {
        vi.stubGlobal('fetch', servir());

        montar();

        await userEvent.type(
            await screen.findByLabelText(t.eventos.nome),
            'Assalto ao banco',
        );
        await userEvent.type(
            screen.getByLabelText(t.eventos.comeca),
            '2026-12-24T21:00',
        );
        await userEvent.click(screen.getByLabelText(t.eventos.porNaMontra));
        await userEvent.click(
            screen.getByRole('button', { name: t.eventos.marcar }),
        );

        await waitFor(() => {
            expect(
                (screen.getByLabelText(t.eventos.porNaMontra) as HTMLInputElement)
                    .checked,
            ).toBe(false);
        });
    });
});
