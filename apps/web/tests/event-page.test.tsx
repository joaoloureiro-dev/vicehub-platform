import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

import { AuthProvider } from '../src/auth/auth.context.js';
import { EventPage } from '../src/events/pages/event.page.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const detalhe = (extra: Record<string, unknown> = {}) => ({
    id: 'ev-1',
    name: 'Corrida noturna',
    description: null,
    status: 'scheduled',
    startsAt: '2026-12-24T21:00:00.000Z',
    endsAt: null,
    capacity: null,
    isPublic: false,
    organizerId: 'u1',
    signedUpCount: 0,
    confirmedCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...extra,
});

const servir = (evento = detalhe()) =>
    vi.fn((url: string, init?: { method?: string }) => {
        const endereco = String(url);

        if (endereco.endsWith('/auth/refresh')) {
            return Promise.resolve(
                json(200, {
                    accessToken: 'token',
                    user: { id: 'u1', email: 'dono@vicehub.test', username: 'dono' },
                }),
            );
        }

        if (init?.method === 'PATCH') {
            return Promise.resolve(json(200, evento));
        }

        if (endereco.endsWith('/participants')) {
            return Promise.resolve(json(200, []));
        }

        if (endereco.includes('/events/')) {
            return Promise.resolve(json(200, evento));
        }

        throw new Error(`rota não prevista pelo duplo: ${endereco}`);
    });

const chamada = (
    fetchMock: ReturnType<typeof vi.fn>,
    metodo: string,
): string | undefined => {
    const encontrada = fetchMock.mock.calls.find(
        (argumentos) =>
            (argumentos[1] as { method?: string } | undefined)?.method === metodo
            && !String(argumentos[0]).endsWith('/participants')
            && String(argumentos[0]).includes('/events/'),
    );

    return encontrada ? String(encontrada[0]) : undefined;
};

/**
 * As duas rotas por que este ecrã é alcançável, montadas sempre. Um ecrã
 * que pergunte sempre à crew funciona enquanto for aberto por uma crew,
 * e é por isso que os dois casos têm de estar aqui.
 */
const montar = (entrada: string) =>
    montarEcra(
        <AuthProvider>
            <Routes>
                <Route
                    path="/crews/:crewId/eventos/:eventId"
                    element={<EventPage />}
                />
                <Route
                    path="/servidores/:serverId/eventos/:eventId"
                    element={<EventPage />}
                />
            </Routes>
        </AuthProvider>,
        entrada,
    );

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('um evento, de uma crew ou de um servidor', () => {
    it('pede o evento à crew, quando é de uma crew', async () => {
        const fetchMock = servir();
        vi.stubGlobal('fetch', fetchMock);

        montar('/crews/crew-1/eventos/ev-1');

        await waitFor(() => {
            expect(chamada(fetchMock, 'GET')).toBe(
                '/api/v1/events/crews/crew-1/ev-1',
            );
        });
    });

    it('pede o evento ao servidor, quando é de um servidor', async () => {
        const fetchMock = servir();
        vi.stubGlobal('fetch', fetchMock);

        montar('/servidores/srv-1/eventos/ev-1');

        await waitFor(() => {
            expect(chamada(fetchMock, 'GET')).toBe(
                '/api/v1/events/servers/srv-1/ev-1',
            );
        });
    });

    it('volta ao calendário do servidor, e não ao de uma crew', async () => {
        vi.stubGlobal('fetch', servir());

        montar('/servidores/srv-1/eventos/ev-1');

        const voltar = await screen.findAllByText(t.eventos.todosOsEventos);

        expect(voltar[0]?.getAttribute('href')).toBe('/servidores/srv-1/eventos');
    });

    it('volta ao calendário da crew, quando é de uma crew', async () => {
        vi.stubGlobal('fetch', servir());

        montar('/crews/crew-1/eventos/ev-1');

        const voltar = await screen.findAllByText(t.eventos.todosOsEventos);

        expect(voltar[0]?.getAttribute('href')).toBe('/crews/crew-1/eventos');
    });

    /**
     * Pôr um evento à porta é uma escrita, e uma escrita no titular
     * errado responde 403 — ou, pior, acerta noutra comunidade.
     */
    it('publica sob o servidor que está aberto', async () => {
        const fetchMock = servir();
        vi.stubGlobal('fetch', fetchMock);

        montar('/servidores/srv-1/eventos/ev-1');

        await userEvent.click(
            await screen.findByRole('button', { name: t.eventos.porNaMontra }),
        );

        await waitFor(() => {
            expect(chamada(fetchMock, 'PATCH')).toBe(
                '/api/v1/events/servers/srv-1/ev-1',
            );
        });
    });

    /**
     * O botão diz o que faz a seguir, e não o estado em que está: num
     * evento já público, o que resta é tirá-lo.
     */
    it('num evento já público, oferece tirá-lo da montra', async () => {
        vi.stubGlobal('fetch', servir(detalhe({ isPublic: true })));

        montar('/servidores/srv-1/eventos/ev-1');

        expect(
            await screen.findByRole('button', { name: t.eventos.tirarDaMontra }),
        ).toBeDefined();

        expect(screen.getByText(t.eventos.naMontra)).toBeDefined();
    });
});
