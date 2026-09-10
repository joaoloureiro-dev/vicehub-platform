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

        if (String(url).includes('/events/')) {
            return Promise.resolve(json(200, eventos));
        }

        throw new Error(`rota não prevista pelo duplo: ${String(url)}`);
    });

/**
 * O endereço da leitura do calendário.
 *
 * `method` vem sempre preenchido pelo cliente da API — mesmo num GET —,
 * por isso o que distingue a leitura da criação é ser um GET e não a
 * ausência de método.
 */
const enderecoDoGet = (fetchMock: ReturnType<typeof vi.fn>): string =>
    String(
        fetchMock.mock.calls.find(
            (argumentos) =>
                (argumentos[1] as { method?: string } | undefined)?.method ===
                'GET',
        )?.[0] ?? '',
    );

const enderecoDoPost = (fetchMock: ReturnType<typeof vi.fn>): string =>
    String(
        fetchMock.mock.calls.find(
            (argumentos) =>
                (argumentos[1] as { method?: string } | undefined)?.method ===
                'POST',
        )?.[0] ?? '',
    );

const evento = {
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
};

const preencher = async () => {
    await userEvent.type(
        await screen.findByLabelText(t.eventos.nome),
        'Assalto ao banco',
    );
    await userEvent.type(
        screen.getByLabelText(t.eventos.comeca),
        '2026-12-24T21:00',
    );
};

const corpoDoPost = (fetchMock: ReturnType<typeof vi.fn>): unknown => {
    const chamada = fetchMock.mock.calls.find(
        (argumentos) =>
            (argumentos[1] as { method?: string } | undefined)?.method === 'POST',
    );

    return JSON.parse(
        String((chamada?.[1] as { body?: string } | undefined)?.body ?? '{}'),
    );
};

/**
 * O mesmo ecrã, nas duas rotas por que é alcançável. Montar as duas
 * sempre — e não só a que o caso usa — é o que faz um teste falhar
 * quando alguém troca uma pela outra.
 */
const montar = (entrada = '/crews/crew-1/eventos') =>
    montarEcra(
        <Routes>
            <Route path="/crews/:crewId/eventos" element={<EventsPage />} />
            <Route
                path="/servidores/:serverId/eventos"
                element={<EventsPage />}
            />
        </Routes>,
        entrada,
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

        await preencher();
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

        await preencher();
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

        await preencher();
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

/**
 * O calendário é o mesmo ecrã para uma crew e para um servidor, como as
 * rotas da API. O que muda é o titular — e é fácil de partir sem
 * ninguém dar por isso, porque um ecrã que peça sempre à crew *funciona*
 * enquanto for aberto por uma crew.
 *
 * Os endereços também não são simétricos: a API diz `servers` e o site
 * diz `servidores`. Cada um destes testes fixa um dos dois.
 */
describe('o calendário serve as duas comunidades', () => {
    it('pede à API os eventos da crew, quando é de uma crew', async () => {
        const fetchMock = servir();
        vi.stubGlobal('fetch', fetchMock);

        montar('/crews/crew-1/eventos');

        await waitFor(() => {
            expect(enderecoDoGet(fetchMock)).toBe('/api/v1/events/crews/crew-1');
        });
    });

    it('pede à API os eventos do servidor, quando é de um servidor', async () => {
        const fetchMock = servir();
        vi.stubGlobal('fetch', fetchMock);

        montar('/servidores/srv-1/eventos');

        await waitFor(() => {
            expect(enderecoDoGet(fetchMock)).toBe('/api/v1/events/servers/srv-1');
        });
    });

    it('marca o evento sob o servidor que está aberto', async () => {
        const fetchMock = servir();
        vi.stubGlobal('fetch', fetchMock);

        montar('/servidores/srv-1/eventos');

        await preencher();
        await userEvent.click(
            screen.getByRole('button', { name: t.eventos.marcar }),
        );

        await waitFor(() => {
            expect(enderecoDoPost(fetchMock)).toBe(
                '/api/v1/events/servers/srv-1',
            );
        });
    });

    it('volta para a página do servidor, e não para a de uma crew', async () => {
        vi.stubGlobal('fetch', servir());

        montar('/servidores/srv-1/eventos');

        const voltar = await screen.findByText(t.eventos.verComunidade);

        expect(voltar.getAttribute('href')).toBe('/servidores/srv-1');
    });

    it('volta para a página da crew, quando é de uma crew', async () => {
        vi.stubGlobal('fetch', servir());

        montar('/crews/crew-1/eventos');

        const voltar = await screen.findByText(t.eventos.verComunidade);

        expect(voltar.getAttribute('href')).toBe('/crews/crew-1');
    });

    it('abre o evento sob o servidor que está aberto', async () => {
        vi.stubGlobal('fetch', servir([evento]));

        montar('/servidores/srv-1/eventos');

        const ligacao = await screen.findByText('Corrida noturna');

        expect(ligacao.getAttribute('href')).toBe(
            '/servidores/srv-1/eventos/ev-1',
        );
    });

    it('abre o evento sob a crew, quando é de uma crew', async () => {
        vi.stubGlobal('fetch', servir([evento]));

        montar('/crews/crew-1/eventos');

        const ligacao = await screen.findByText('Corrida noturna');

        expect(ligacao.getAttribute('href')).toBe('/crews/crew-1/eventos/ev-1');
    });
});
