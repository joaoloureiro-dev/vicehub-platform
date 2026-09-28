import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

import { AuthProvider } from '../src/auth/auth.context.js';
import { LeaderboardPage } from '../src/affiliations/pages/leaderboard.page.js';
import { montarEcra, t } from './helpers.js';

/**
 * O quadro de um servidor, no ecrã.
 *
 * Que o lugar está bem calculado é do servidor e tem os testes dele. O
 * que aqui se guarda é o que o ecrã faz com a resposta:
 *
 * - que mostra o lugar que vem da API, e não o número da linha — duas
 *   crews empatadas partilham-no, e um ecrã que numerasse as linhas
 *   desfazia o empate à revelia de quem o calculou;
 * - que se lê sem sessão, porque quem procura onde levar a crew quer
 *   ver contra quem vai jogar antes de criar conta;
 * - e que um servidor sem crews diz isso em vez de mostrar uma tabela
 *   vazia com cabeçalhos.
 */
const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const SERVIDOR = {
    id: 'server-1',
    name: 'Leonida Nights',
    region: 'EU',
    description: null,
    isOnline: true,
    isPremium: false,
    appearance: { bannerUrl: null, accentColor: null },
    memberCount: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
};

const linha = (
    position: number,
    crewId: string,
    crewName: string,
    level: number,
    xp: string,
) => ({ position, crewId, crewName, crewTag: crewId.toUpperCase(), level, xp });

const QUADRO = {
    entries: [
        linha(1, 'neon', 'Neon Harbour', 4, '900'),
        linha(1, 'vice', 'Vice Kings', 4, '900'),
        linha(3, 'dusk', 'Dusk Runners', 2, '100'),
    ],
    page: 1,
    pages: 1,
    total: 3,
};

/**
 * O duplo nomeia as rotas que conhece e rebenta nas outras. Um duplo
 * que responda a tudo esconde um pedido a mais — e um pedido a mais
 * numa lista é o que a faz piscar.
 */
const responder = (opcoes: {
    quadro?: unknown;
    estadoDoQuadro?: number;
    servidor?: number;
    comSessao?: boolean;
} = {}): ReturnType<typeof vi.fn> => {
    const chamadas = vi.fn((entrada: string) => {
        const endereco = String(entrada);

        if (endereco.endsWith('/auth/refresh')) {
            return Promise.resolve(
                opcoes.comSessao === false
                    ? json(401, { code: 'INVALID_REFRESH_TOKEN' })
                    : json(200, {
                        accessToken: 'token',
                        user: {
                            id: 'u1',
                            email: 'quem@vicehub.test',
                            username: 'quem',
                        },
                    }),
            );
        }

        if (endereco.includes('/leaderboard')) {
            return Promise.resolve(
                json(
                    opcoes.estadoDoQuadro ?? 200,
                    opcoes.quadro ?? QUADRO,
                ),
            );
        }

        if (endereco.includes('/servers/')) {
            return Promise.resolve(
                json(opcoes.servidor ?? 200, {
                    ...SERVIDOR,
                    ...(opcoes.servidor === 404
                        ? { code: 'SERVER_NOT_FOUND' }
                        : {}),
                }),
            );
        }

        throw new Error(`pedido não previsto: ${endereco}`);
    });

    vi.stubGlobal('fetch', chamadas);

    return chamadas;
};

afterEach(() => {
    vi.unstubAllGlobals();
});

const abrir = () =>
    montarEcra(
        <AuthProvider>
            <Routes>
                <Route
                    path="/servidores/:serverId/quadro"
                    element={<LeaderboardPage />}
                />
            </Routes>
        </AuthProvider>,
        '/servidores/server-1/quadro',
    );

/** As linhas da tabela, sem o cabeçalho. */
const linhas = () =>
    within(screen.getAllByRole('rowgroup')[1] as HTMLElement).getAllByRole('row');

describe('o quadro de um servidor', () => {
    it('diz de que servidor é', async () => {
        responder();
        abrir();

        expect(
            await screen.findByText(t.quadro.subtitulo('Leonida Nights')),
        ).toBeTruthy();
    });

    it('mostra as crews pela ordem que a API deu', async () => {
        responder();
        abrir();

        await screen.findByText('Neon Harbour');

        expect(linhas().map((l) => within(l).getAllByRole('cell')[1]?.textContent))
            .toEqual([
                expect.stringContaining('Neon Harbour'),
                expect.stringContaining('Vice Kings'),
                expect.stringContaining('Dusk Runners'),
            ]);
    });

    /**
     * **O lugar vem da API, e não do número da linha.**
     *
     * Duas crews empatadas partilham-no. Um ecrã que numerasse as
     * linhas escreveria 1, 2, 3 e desfazia o empate à revelia de quem
     * o calculou — e a segunda das empatadas apareceria atrás da
     * primeira sem nada a separá-las.
     */
    it('e o lugar que a API deu, empates incluídos', async () => {
        responder();
        abrir();

        await screen.findByText('Neon Harbour');

        expect(linhas().map((l) => within(l).getAllByRole('cell')[0]?.textContent))
            .toEqual(['1', '1', '3']);
    });

    it('diz o nível e o xp de cada crew', async () => {
        responder();
        abrir();

        await screen.findByText('Neon Harbour');

        const primeira = linhas()[0] as HTMLElement;
        const celulas = within(primeira).getAllByRole('cell');

        expect(celulas[2]?.textContent).toBe('4');
        expect(celulas[3]?.textContent).toBe('900');
    });

    /** Cada crew é uma ligação para o perfil dela. */
    it('leva ao perfil de cada crew', async () => {
        responder();
        abrir();

        const ligacao = await screen.findByText('Neon Harbour');

        expect(ligacao.getAttribute('href')).toBe('/crews/neon');
    });

    /**
     * A regra dos empates fica escrita por baixo do quadro: quem lê um
     * 1, um 1 e um 3 sem saber a regra lê um erro.
     */
    it('explica como se contam os lugares', async () => {
        responder();
        abrir();

        expect(await screen.findByText(t.quadro.comoSeConta)).toBeTruthy();
    });

    it('e volta ao servidor de onde veio', async () => {
        responder();
        abrir();

        const voltar = await screen.findByText(t.quadro.voltarAoServidor);

        expect(voltar.getAttribute('href')).toBe('/servidores/server-1');
    });

    /**
     * Sem sessão. Quem anda à procura de onde levar a crew quer ver
     * contra quem vai jogar antes de criar conta nenhuma — e uma
     * classificação que só quem lá está pode ver não serve nem a quem
     * lá está.
     */
    it('lê-se sem sessão nenhuma', async () => {
        responder({ comSessao: false });
        abrir();

        expect(await screen.findByText('Neon Harbour')).toBeTruthy();
    });

    /**
     * Um servidor sem crews diz isso. Uma tabela vazia com cabeçalhos
     * parece uma avaria, e não a resposta honesta de que ainda não
     * joga lá ninguém.
     */
    it('um quadro vazio diz que ainda não joga lá ninguém', async () => {
        responder({ quadro: { entries: [], page: 1, pages: 1, total: 0 } });
        abrir();

        expect(await screen.findByText(t.quadro.aindaSemCrews)).toBeTruthy();
        expect(screen.queryByRole('table')).toBeNull();
    });

    it('diz quando o quadro não carrega', async () => {
        responder({ estadoDoQuadro: 500, quadro: { code: 'INTERNAL' } });
        abrir();

        expect(await screen.findByText(t.quadro.naoCarregou)).toBeTruthy();
    });

    it('e quando o servidor não existe, fala do servidor', async () => {
        responder({ servidor: 404 });
        abrir();

        expect(
            await screen.findByText(t.servidores.naoEncontrado),
        ).toBeTruthy();
    });

    describe('quando há mais do que uma página', () => {
        const paginado = {
            entries: [linha(26, 'late', 'Latecomers', 1, '0')],
            page: 1,
            pages: 2,
            total: 26,
        };

        it('pede a página seguinte à API', async () => {
            const chamadas = responder({ quadro: paginado });
            abrir();

            await screen.findByText('Latecomers');
            await userEvent.click(screen.getByText(t.crews.seguinte));

            await waitFor(() => {
                expect(
                    chamadas.mock.calls.some((argumentos) =>
                        String(argumentos[0]).includes('page=2'),
                    ),
                ).toBe(true);
            });
        });

        /** Numa página só, não há paginação nenhuma a mostrar. */
        it('e não a mostra quando não há para onde ir', async () => {
            responder();
            abrir();

            await screen.findByText('Neon Harbour');

            expect(screen.queryByText(t.crews.seguinte)).toBeNull();
        });
    });
});
