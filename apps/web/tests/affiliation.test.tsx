import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CrewAffiliation } from '../src/affiliations/components/crew-affiliation.js';
import { ServerCrews } from '../src/affiliations/components/server-crews.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

/** O corpo com que a filiação foi pedida. */
const corpoDoPost = (fetchMock: ReturnType<typeof vi.fn>): unknown => {
    const chamada = fetchMock.mock.calls.find(
        (argumentos) =>
            (argumentos[1] as { method?: string } | undefined)?.method === 'POST',
    );

    return JSON.parse(
        String((chamada?.[1] as { body?: string } | undefined)?.body ?? '{}'),
    );
};

const urlChamada = (
    fetchMock: ReturnType<typeof vi.fn>,
    method: string,
): string | undefined => {
    const chamada = fetchMock.mock.calls.find(
        (argumentos) =>
            (argumentos[1] as { method?: string } | undefined)?.method === method,
    );

    return chamada === undefined ? undefined : String(chamada[0]);
};

afterEach(() => {
    vi.unstubAllGlobals();
});

/**
 * A filiação de uma crew a um servidor.
 *
 * O que estes testes guardam não é o desenho do painel: é que **pedir
 * não é entrar**. Uma crew que pediu continua sem servidor até alguém
 * do outro lado responder, e o ecrã tem de dizer isso — se disser
 * "joga em X" a quem só pediu, quem lê fica convencido de que tem o que
 * ainda não tem.
 */
describe('a filiação vista do lado da crew', () => {
    const servidorApi = (estado: unknown, resultados: unknown[] = []) =>
        vi.fn((url: string) => {
            const endereco = String(url);

            if (endereco.includes('/servers?') || endereco.endsWith('/servers')) {
                return Promise.resolve(
                    json(200, { items: resultados, total: resultados.length, page: 1, pageSize: 20, featured: [] }),
                );
            }

            return Promise.resolve(json(200, estado));
        });

    it('diz onde a crew joga', async () => {
        vi.stubGlobal(
            'fetch',
            servidorApi({ server: { id: 's-1', name: 'Vice City RP' }, pending: null }),
        );

        montarEcra(<CrewAffiliation crewId="crew-1" podeGerir={false} />);

        expect(await screen.findByText('Vice City RP')).toBeDefined();
    });

    /**
     * O caso que dá razão a tudo isto: um pedido não é uma entrada.
     */
    it('não diz que joga num servidor a quem apenas pediu', async () => {
        vi.stubGlobal(
            'fetch',
            servidorApi({ server: null, pending: { id: 's-1', name: 'Vice City RP' } }),
        );

        montarEcra(<CrewAffiliation crewId="crew-1" podeGerir={false} />);

        expect(await screen.findByText(t.filiacao.pedidoEnviado)).toBeDefined();
        expect(screen.queryByText(t.filiacao.jogaEm)).toBeNull();
    });

    it('não mostra botões a quem não manda na crew', async () => {
        vi.stubGlobal('fetch', servidorApi({ server: null, pending: null }));

        montarEcra(<CrewAffiliation crewId="crew-1" podeGerir={false} />);

        expect(await screen.findByText(t.filiacao.semServidor)).toBeDefined();
        expect(screen.queryByLabelText(t.filiacao.procurar)).toBeNull();
    });

    it('pede a filiação ao servidor escolhido', async () => {
        const fetchMock = servidorApi({ server: null, pending: null }, [
            { id: 's-7', name: 'Los Santos RP', region: null, description: null, isOnline: true, isPremium: false, appearance: { bannerUrl: null, accentColor: null }, memberCount: 3, createdAt: '2026-01-01T00:00:00.000Z' },
        ]);
        vi.stubGlobal('fetch', fetchMock);

        montarEcra(<CrewAffiliation crewId="crew-1" podeGerir />);

        await userEvent.type(
            await screen.findByLabelText(t.filiacao.procurar),
            'Los',
        );

        await userEvent.click(await screen.findByLabelText('Los Santos RP'));
        await userEvent.click(
            screen.getByRole('button', { name: t.filiacao.pedir }),
        );

        await waitFor(() => {
            expect(corpoDoPost(fetchMock)).toEqual({ serverId: 's-7' });
        });
    });

    /**
     * Sair e desistir do pedido são dois caminhos diferentes na API, e
     * quem carrega no botão está em apenas um dos dois estados.
     */
    it('a saída do servidor vai pela rota da filiação', async () => {
        const fetchMock = servidorApi({
            server: { id: 's-1', name: 'Vice City RP' },
            pending: null,
        });
        vi.stubGlobal('fetch', fetchMock);

        montarEcra(<CrewAffiliation crewId="crew-1" podeGerir />);

        await userEvent.click(
            await screen.findByRole('button', { name: t.filiacao.sair }),
        );

        await waitFor(() => {
            expect(urlChamada(fetchMock, 'DELETE')).toMatch(
                /\/crews\/crew-1\/affiliation$/,
            );
        });
    });

    it('a desistência vai pela rota do pedido', async () => {
        const fetchMock = servidorApi({
            server: null,
            pending: { id: 's-1', name: 'Vice City RP' },
        });
        vi.stubGlobal('fetch', fetchMock);

        montarEcra(<CrewAffiliation crewId="crew-1" podeGerir />);

        await userEvent.click(
            await screen.findByRole('button', { name: t.filiacao.desistir }),
        );

        await waitFor(() => {
            expect(urlChamada(fetchMock, 'DELETE')).toMatch(
                /\/crews\/crew-1\/affiliation\/request$/,
            );
        });
    });
});

describe('as crews vistas do lado do servidor', () => {
    const crewAtiva = {
        crewId: 'crew-1',
        crewName: 'Vice Kings',
        crewTag: 'VICE',
        status: 'active',
        requestedAt: '2026-01-01T00:00:00.000Z',
        respondedAt: '2026-01-02T00:00:00.000Z',
    };

    const pedido = { ...crewAtiva, crewId: 'crew-2', crewName: 'Novatos', crewTag: 'NOV', status: 'pending', respondedAt: null };

    const servidorApi = (ativas: unknown[], pedidos: unknown[]) =>
        vi.fn((url: string) =>
            Promise.resolve(
                json(200, String(url).endsWith('/requests') ? pedidos : ativas),
            ),
        );

    it('mostra as crews que lá jogam', async () => {
        vi.stubGlobal('fetch', servidorApi([crewAtiva], []));

        montarEcra(<ServerCrews serverId="server-1" podeGerir={false} />);

        expect(await screen.findByText('Vice Kings')).toBeDefined();
    });

    /**
     * Quem passa não vê quem pediu para entrar: é a caixa de entrada de
     * quem gere o servidor. O painel nem sequer pede a lista.
     */
    it('não pede os pedidos a quem não manda no servidor', async () => {
        const fetchMock = servidorApi([crewAtiva], [pedido]);
        vi.stubGlobal('fetch', fetchMock);

        montarEcra(<ServerCrews serverId="server-1" podeGerir={false} />);

        await screen.findByText('Vice Kings');

        expect(
            fetchMock.mock.calls.some((argumentos) =>
                String(argumentos[0]).endsWith('/requests'),
            ),
        ).toBe(false);
        expect(screen.queryByText('Novatos')).toBeNull();
    });

    it('mostra os pedidos a quem manda no servidor', async () => {
        vi.stubGlobal('fetch', servidorApi([crewAtiva], [pedido]));

        montarEcra(<ServerCrews serverId="server-1" podeGerir />);

        expect(await screen.findByText('Novatos')).toBeDefined();
        expect(
            screen.getByRole('button', { name: t.filiacao.aceitar }),
        ).toBeDefined();
    });

    it('aceitar chama a rota do servidor, com a crew no endereço', async () => {
        const fetchMock = servidorApi([], [pedido]);
        vi.stubGlobal('fetch', fetchMock);

        montarEcra(<ServerCrews serverId="server-1" podeGerir />);

        await userEvent.click(
            await screen.findByRole('button', { name: t.filiacao.aceitar }),
        );

        await waitFor(() => {
            expect(urlChamada(fetchMock, 'POST')).toMatch(
                /\/servers\/server-1\/affiliations\/crew-2\/accept$/,
            );
        });
    });
});
