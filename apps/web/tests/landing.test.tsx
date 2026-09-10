import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { LandingPage } from '../src/pages/landing.page.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const crew = (extra: Record<string, unknown> = {}) => ({
    id: 'crew-1',
    name: 'Leonida Boys',
    tag: 'LB',
    description: 'Roleplay sério.',
    isRecruiting: true,
    recruitingSince: '2026-09-01T00:00:00.000Z',
    level: 3,
    memberCount: 8,
    isPremium: false,
    appearance: { bannerUrl: null, accentColor: null },
    createdAt: '2026-01-01T00:00:00.000Z',
    ...extra,
});

const servidor = (extra: Record<string, unknown> = {}) => ({
    id: 'srv-1',
    name: 'Leonida Life',
    region: 'EU',
    description: null,
    isOnline: true,
    playersOnline: 42,
    memberCount: 3,
    isPremium: false,
    appearance: { bannerUrl: null, accentColor: null },
    createdAt: '2026-01-01T00:00:00.000Z',
    ...extra,
});

const pagina = (items: unknown[]) => ({
    items,
    featured: [],
    page: 1,
    pageSize: 20,
    total: items.length,
    totalPages: 1,
});

const evento = (extra: Record<string, unknown> = {}) => ({
    id: 'ev-1',
    name: 'Assalto ao banco',
    status: 'scheduled',
    startsAt: '2026-12-24T21:00:00.000Z',
    endsAt: null,
    owner: { kind: 'crew', id: 'crew-1', name: 'Leonida Boys', tag: 'LB' },
    ...extra,
});

/**
 * Responde a cada rota com o que o caso quiser.
 *
 * Cada uma é nomeada, e não há ramo que sirva de apanha-tudo: um duplo
 * que respondesse "o resto" com a lista de servidores fazia a montra de
 * eventos receber uma página paginada, calar-se, e o teste passar na
 * mesma. Já aconteceu neste ficheiro; é por isso que está escrito assim.
 */
const servir = (
    crews: unknown[],
    servidores: unknown[],
    eventos: unknown[] = [],
) =>
    vi.fn((url: string) => {
        const endereco = String(url);

        if (endereco.includes('/events/public')) {
            return Promise.resolve(json(200, eventos));
        }

        if (endereco.includes('/crews')) {
            return Promise.resolve(json(200, pagina(crews)));
        }

        if (endereco.includes('/servers')) {
            return Promise.resolve(json(200, pagina(servidores)));
        }

        throw new Error(`rota não prevista pelo duplo: ${endereco}`);
    });

afterEach(() => {
    vi.unstubAllGlobals();
});

/**
 * A porta de entrada.
 *
 * O que aqui se prova é que a página mostra **o que está a acontecer**, e
 * não três parágrafos sobre o que a plataforma faria. Uma plataforma de
 * comunidades que parece vazia diz a quem chega que chegou tarde.
 */
describe('a landing', () => {
    it('mostra as crews que estão a recrutar', async () => {
        vi.stubGlobal('fetch', servir([crew()], []));

        montarEcra(<LandingPage />);

        expect(await screen.findByText('Leonida Boys')).toBeDefined();
    });

    /**
     * Pede à API só quem recruta. Sem o filtro, esta secção mostrava o
     * diretório inteiro debaixo de um título que promete outra coisa —
     * e alguém candidatava-se a uma crew que não está à procura.
     */
    it('pede à API só quem recruta', async () => {
        const fetchMock = servir([crew()], []);
        vi.stubGlobal('fetch', fetchMock);

        montarEcra(<LandingPage />);

        await waitFor(() => {
            expect(screen.getByText('Leonida Boys')).toBeDefined();
        });

        const pedidos = fetchMock.mock.calls
            .map((argumentos) => String(argumentos[0]))
            .filter((url) => url.includes('/crews'));

        expect(pedidos.some((url) => url.includes('recruiting=true'))).toBe(true);
    });

    it('mostra os servidores que estão online', async () => {
        vi.stubGlobal('fetch', servir([], [servidor()]));

        montarEcra(<LandingPage />);

        expect(await screen.findByText('Leonida Life')).toBeDefined();
        expect(screen.getByText(t.landing.jogadores(42))).toBeDefined();
    });

    /**
     * Um servidor em baixo não vai para a montra a dizer que está
     * fechado: sai da lista.
     */
    it('não mostra servidores em baixo', async () => {
        vi.stubGlobal(
            'fetch',
            servir([], [servidor({ isOnline: false, name: 'Adormecido' })]),
        );

        montarEcra(<LandingPage />);

        await waitFor(() => {
            expect(screen.getByText(t.landing.planosTitulo)).toBeDefined();
        });

        expect(screen.queryByText('Adormecido')).toBeNull();
        expect(screen.queryByText(t.landing.agoraOnline)).toBeNull();
    });

    /**
     * Sem contagem reportada não se inventa um zero: null quer dizer
     * "ninguém instalou o recurso ainda", e zero diz que o servidor está
     * vazio — que é outra coisa, e mais feia.
     */
    it('não inventa uma contagem que ninguém reportou', async () => {
        vi.stubGlobal(
            'fetch',
            servir([], [servidor({ playersOnline: null })]),
        );

        const { container } = montarEcra(<LandingPage />);

        await waitFor(() => {
            expect(screen.getByText('Leonida Life')).toBeDefined();
        });

        /**
         * A ausência do elemento, e não a ausência de um texto concreto.
         *
         * A primeira versão disto procurava por "0 players" e passava
         * com a verificação removida — porque o que aparecia era "null
         * players", que não é o texto procurado. Um teste que só apanha
         * o zero deixa passar tudo o resto.
         */
        expect(container.querySelector('.landing-jogadores')).toBeNull();
    });

    /**
     * O que uma comunidade abriu ao público é a primeira coisa que quem
     * chega vê: é a resposta à pergunta que faz sem a dizer — isto tem
     * gente?
     */
    it('mostra o que as comunidades puseram à porta', async () => {
        vi.stubGlobal('fetch', servir([], [], [evento()]));

        montarEcra(<LandingPage />);

        expect(await screen.findByText('Assalto ao banco')).toBeDefined();
        expect(screen.getByText(t.landing.naCrew('Leonida Boys'))).toBeDefined();
    });

    /**
     * A decorrer agora e começa às nove são leituras diferentes da
     * mesma linha, e quem chega quer saber qual delas é: uma dá para ir
     * já.
     */
    it('distingue o que está a decorrer do que ainda vai começar', async () => {
        vi.stubGlobal(
            'fetch',
            servir([], [], [evento({ status: 'ongoing' })]),
        );

        montarEcra(<LandingPage />);

        expect(
            await screen.findByText(t.landing.aDecorrerAgora),
        ).toBeDefined();
    });

    /**
     * A ligação leva ao dono do evento, e o dono pode ser um servidor —
     * a montra atravessa os dois. Um link que assumisse crew mandava
     * quem carregasse para uma página que não existe.
     */
    it('liga ao servidor quando o evento é de um servidor', async () => {
        vi.stubGlobal(
            'fetch',
            servir(
                [],
                [],
                [
                    evento({
                        name: 'Noite de corridas',
                        owner: {
                            kind: 'server',
                            id: 'srv-9',
                            name: 'Leonida Life',
                            tag: null,
                        },
                    }),
                ],
            ),
        );

        montarEcra(<LandingPage />);

        const ligacao = (await screen.findByText('Noite de corridas'))
            .closest('a');

        expect(ligacao?.getAttribute('href')).toBe('/servidores/srv-9');
    });

    /**
     * Sem nada a acontecer, a página não mostra secções vazias — mas o
     * preço fica sempre, porque é a pergunta que toda a gente faz antes
     * de criar conta.
     */
    it('sem nada a acontecer, continua a dizer quanto custa', async () => {
        vi.stubGlobal('fetch', servir([], []));

        montarEcra(<LandingPage />);

        expect(await screen.findByText(t.landing.planosTitulo)).toBeDefined();
        expect(screen.getByText(t.landing.planoServidorPreco)).toBeDefined();
        expect(screen.queryByText(t.landing.quemRecruta)).toBeNull();
        expect(screen.queryByText(t.landing.aAcontecer)).toBeNull();
    });
});
