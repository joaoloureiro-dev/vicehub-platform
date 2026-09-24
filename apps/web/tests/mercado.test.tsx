import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

import { AuthProvider } from '../src/auth/auth.context.js';
import { AnuncioPage } from '../src/market/pages/anuncio.page.js';
import { MercadoPage } from '../src/market/pages/mercado.page.js';
import { sessionStore } from '../src/lib/session.js';
import { montarEcra, t } from './helpers.js';

/**
 * O mercado de um servidor.
 *
 * O que aqui se guarda não é a redação. É o que se parte sem ninguém
 * dar por isso:
 *
 * - **o preço nunca passa por `Number`.** É `BigInt` do outro lado, e
 *   um preço grande que passe por um número de JavaScript volta
 *   arredondado — o género de erro que só aparece quando duas pessoas
 *   discutem uma venda;
 * - **os botões são de quem anunciou**, e um anúncio de uma conta
 *   apagada não passa a ser de toda a gente;
 * - **a frase da moeda de jogo está onde se vê**, porque é aqui que
 *   alguém chega a pensar em vender alguma coisa.
 */
const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const EU = { id: 'u1', email: 'quem@vicehub.test', username: 'quem' };

/** Novecentos mil milhões: acima do que um número de JavaScript guarda. */
const PRECO_ENORME = '999999999999';

const ANUNCIO = {
    id: 'anuncio-1',
    category: 'vehicle' as const,
    title: 'Banshee 900R',
    body: 'Pouco uso, entrega no parque do porto.',
    price: '250000',
    imageUrl: null,
    status: 'open' as 'open' | 'sold' | 'withdrawn',
    seller: { id: 'u1', username: 'quem', avatarUrl: null } as
        | { id: string; username: string; avatarUrl: null }
        | null,
    sellerId: 'u1' as string | null,
    serverId: 's1',
    serverName: 'Vice Roleplay',
    closedAt: null as string | null,
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
};

/** Nomeia cada rota que o ecrã usa, e rebenta nas outras. */
const responder = (opcoes: {
    anuncio?: Partial<typeof ANUNCIO>;
    lista?: (typeof ANUNCIO)[];
    semSessao?: boolean;
    aoCriar?: Response;
    aoFechar?: Response;
} = {}) =>
    vi.fn((url: string, init?: { method?: string }) => {
        const endereco = String(url);
        const metodo = init?.method ?? 'GET';

        if (endereco.endsWith('/auth/refresh')) {
            return Promise.resolve(
                opcoes.semSessao === true
                    ? json(401, { code: 'UNAUTHORIZED' })
                    : json(200, { accessToken: 'token', user: EU }),
            );
        }

        if (endereco.includes('/market/listings/anuncio-1/reports')) {
            return Promise.resolve(json(201, { id: 'denuncia-1' }));
        }

        if (endereco.includes('/market/listings/anuncio-1/close')) {
            return Promise.resolve(opcoes.aoFechar ?? json(200, { id: 'anuncio-1' }));
        }

        if (endereco.includes('/market/listings/anuncio-1')) {
            if (metodo === 'DELETE') {
                return Promise.resolve(json(204, null));
            }

            if (metodo === 'PATCH') {
                return Promise.resolve(json(200, { id: 'anuncio-1' }));
            }

            return Promise.resolve(
                json(200, { ...ANUNCIO, ...opcoes.anuncio }),
            );
        }

        if (endereco.includes('/market/servers/s1/listings')) {
            if (metodo === 'POST') {
                return Promise.resolve(
                    opcoes.aoCriar ?? json(201, { id: 'anuncio-2' }),
                );
            }

            const lista = opcoes.lista ?? [ANUNCIO];

            return Promise.resolve(
                json(200, {
                    server: { id: 's1', name: 'Vice Roleplay' },
                    listings: lista,
                    page: 1,
                    pages: 1,
                    total: lista.length,
                }),
            );
        }

        throw new Error(`rota não prevista no duplo: ${endereco}`);
    });

const montarMercado = () =>
    montarEcra(
        <AuthProvider>
            <Routes>
                <Route
                    path="/servidores/:serverId/mercado"
                    element={<MercadoPage />}
                />
            </Routes>
        </AuthProvider>,
        '/servidores/s1/mercado',
    );

const montarAnuncio = () =>
    montarEcra(
        <AuthProvider>
            <Routes>
                <Route path="/mercado/:listingId" element={<AnuncioPage />} />
            </Routes>
        </AuthProvider>,
        '/mercado/anuncio-1',
    );

afterEach(() => {
    vi.unstubAllGlobals();
    sessionStore.clear();
});

describe('o mercado de um servidor', () => {
    it('diz de que servidor é, e quantas coisas tem à venda', async () => {
        vi.stubGlobal('fetch', responder());

        montarMercado();

        expect(
            await screen.findByText(t.mercado.sub('Vice Roleplay')),
        ).toBeDefined();

        expect(screen.getByText(t.mercado.quantos(1))).toBeDefined();
    });

    /**
     * A frase da moeda de jogo tem de estar onde alguém a lê antes de
     * vender, e não só nos termos.
     */
    it('diz que os preços são em moeda de jogo', async () => {
        vi.stubGlobal('fetch', responder());

        montarMercado();

        expect(await screen.findByText(t.mercado.moedaDeJogo)).toBeDefined();
    });

    it('deixa ler sem sessão, e não mostra o botão de vender', async () => {
        vi.stubGlobal('fetch', responder({ semSessao: true }));

        montarMercado();

        expect(await screen.findByText('Banshee 900R')).toBeDefined();
        expect(screen.queryByText(t.mercado.anunciar)).toBeNull();
        expect(screen.getByText(t.mercado.entrarParaAnunciar)).toBeDefined();
    });

    it('mostra o vazio de quem ainda não tem nada à venda', async () => {
        vi.stubGlobal('fetch', responder({ lista: [] }));

        montarMercado();

        expect(
            await screen.findByText(t.mercado.aindaSemAnuncios),
        ).toBeDefined();
    });

    it('distingue o mercado vazio do filtro sem resultados', async () => {
        vi.stubGlobal('fetch', responder({ lista: [] }));

        montarMercado();

        await screen.findByText(t.mercado.aindaSemAnuncios);

        await userEvent.click(screen.getByText(t.mercado.categorias.property));

        expect(
            await screen.findByText(t.mercado.nadaNesteFiltro),
        ).toBeDefined();
    });

    /**
     * O preço é texto do princípio ao fim. Se alguém o fizer passar por
     * `Number`, este anúncio aparece com um zero a menos no fim.
     */
    it('não estraga um preço grande de mais para um número', async () => {
        vi.stubGlobal(
            'fetch',
            responder({ lista: [{ ...ANUNCIO, price: PRECO_ENORME }] }),
        );

        montarMercado();

        const preco = await screen.findByText(/999/);

        expect(preco.textContent?.replace(/\D/g, '')).toBe(PRECO_ENORME);
    });

    it('manda o preço tal e qual, sem o converter', async () => {
        const chamadas = responder();

        vi.stubGlobal('fetch', chamadas);

        montarMercado();

        await userEvent.click(await screen.findByText(t.mercado.anunciar));

        await userEvent.type(
            screen.getByLabelText(t.mercado.tituloDoAnuncio),
            'Mansão de Vinewood',
        );
        await userEvent.type(
            screen.getByLabelText(t.mercado.corpoDoAnuncio),
            'Vista para a baía, garagem para seis.',
        );
        await userEvent.type(
            screen.getByLabelText(t.mercado.preco),
            PRECO_ENORME,
        );

        await userEvent.click(screen.getByText(t.mercado.publicar));

        await waitFor(() => {
            /**
             * A chamada do mercado, e não a primeira que for POST: o
             * `refresh` da sessão também o é, e vai sem corpo nenhum.
             */
            const criacao = chamadas.mock.calls.find(
                ([url, init]) =>
                    String(url).includes('/market/servers/s1/listings') &&
                    (init as { method?: string } | undefined)?.method === 'POST',
            );

            expect(criacao).toBeDefined();

            const corpo = JSON.parse(
                (criacao?.[1] as { body: string }).body,
            ) as { price: string; imageUrl: string | null };

            expect(corpo.price).toBe(PRECO_ENORME);
            /** Sem endereço escrito é nulo, e não uma cadeia vazia. */
            expect(corpo.imageUrl).toBeNull();
        });
    });

    /**
     * O erro chega antes do pedido: quem escreve `12,50` fica a saber
     * porquê sem esperar por uma viagem à API.
     */
    it('recusa um preço que não seja algarismos sem chamar a API', async () => {
        const chamadas = responder();

        vi.stubGlobal('fetch', chamadas);

        montarMercado();

        await userEvent.click(await screen.findByText(t.mercado.anunciar));

        await userEvent.type(
            screen.getByLabelText(t.mercado.tituloDoAnuncio),
            'Carro qualquer',
        );
        await userEvent.type(
            screen.getByLabelText(t.mercado.corpoDoAnuncio),
            'Uma descrição que chegue.',
        );
        await userEvent.type(screen.getByLabelText(t.mercado.preco), '12,50');

        await userEvent.click(screen.getByText(t.mercado.publicar));

        expect(await screen.findByText(t.mercado.precoInvalido)).toBeDefined();

        expect(
            chamadas.mock.calls.some(
                ([url, init]) =>
                    String(url).includes('/market/servers/s1/listings') &&
                    (init as { method?: string } | undefined)?.method === 'POST',
            ),
        ).toBe(false);
    });
});

describe('um anúncio', () => {
    it('mostra os botões a quem o escreveu', async () => {
        vi.stubGlobal('fetch', responder());

        montarAnuncio();

        expect(await screen.findByText(t.mercado.editar)).toBeDefined();
        expect(screen.getByText(t.mercado.marcarVendido)).toBeDefined();
        expect(screen.getByText(t.mercado.retirar)).toBeDefined();
    });

    it('não os mostra a mais ninguém', async () => {
        vi.stubGlobal(
            'fetch',
            responder({
                anuncio: {
                    sellerId: 'u2',
                    seller: { id: 'u2', username: 'ana', avatarUrl: null },
                },
            }),
        );

        montarAnuncio();

        expect(await screen.findByText('Banshee 900R')).toBeDefined();
        expect(screen.queryByText(t.mercado.editar)).toBeNull();
        expect(screen.queryByText(t.mercado.retirar)).toBeNull();
    });

    /**
     * `null === null` dava o anúncio de uma conta apagada a qualquer
     * pessoa que estivesse a ver.
     */
    it('não entrega o anúncio de uma conta apagada a quem está a ver', async () => {
        vi.stubGlobal(
            'fetch',
            responder({ anuncio: { sellerId: null, seller: null } }),
        );

        montarAnuncio();

        /**
         * O nome está no meio de uma frase com outras partes, por isso
         * procura-se pelo texto do parágrafo e não por um nó só.
         */
        await waitFor(() => {
            expect(
                screen.getByText(
                    (_, elemento) =>
                        elemento?.tagName === 'P' &&
                        (elemento.textContent ?? '').includes(
                            t.mercado.contaApagada,
                        ),
                ),
            ).toBeDefined();
        });

        expect(screen.queryByText(t.mercado.editar)).toBeNull();
    });

    /**
     * O caso que um mutante encontrou: sem sessão **e** sem vendedor,
     * `null === null` dava os botões a quem passasse por ali. São duas
     * condições, e é por isso que a guarda tem de ser duas.
     */
    it('nem a quem nem sequer tem sessão', async () => {
        vi.stubGlobal(
            'fetch',
            responder({
                semSessao: true,
                anuncio: { sellerId: null, seller: null },
            }),
        );

        montarAnuncio();

        expect(await screen.findByText('Banshee 900R')).toBeDefined();
        expect(screen.queryByText(t.mercado.editar)).toBeNull();
        expect(screen.queryByText(t.mercado.retirar)).toBeNull();
        expect(screen.queryByText(t.mercado.marcarVendido)).toBeNull();
    });

    /**
     * Denunciar é para quem não escreveu o anúncio. A quem o escreveu
     * mostrar-lhe um botão de denunciar o que é seu era convidá-lo a
     * pôr trabalho na fila de outra pessoa por nada.
     */
    it('mostra o botão de denunciar a quem não o escreveu', async () => {
        vi.stubGlobal(
            'fetch',
            responder({
                anuncio: {
                    sellerId: 'u2',
                    seller: { id: 'u2', username: 'ana', avatarUrl: null },
                },
            }),
        );

        montarAnuncio();

        expect(await screen.findByText(t.moderacao.denunciar)).toBeDefined();
    });

    it('e não o mostra a quem o escreveu', async () => {
        vi.stubGlobal('fetch', responder());

        montarAnuncio();

        expect(await screen.findByText(t.mercado.editar)).toBeDefined();
        expect(screen.queryByText(t.moderacao.denunciar)).toBeNull();
    });

    it('nem a quem está sem sessão', async () => {
        vi.stubGlobal('fetch', responder({ semSessao: true }));

        montarAnuncio();

        expect(await screen.findByText('Banshee 900R')).toBeDefined();
        expect(screen.queryByText(t.moderacao.denunciar)).toBeNull();
    });

    it('manda a razão e a nota da denúncia', async () => {
        const chamadas = responder({
            anuncio: {
                sellerId: 'u2',
                seller: { id: 'u2', username: 'ana', avatarUrl: null },
            },
        });

        vi.stubGlobal('fetch', chamadas);

        montarAnuncio();

        await userEvent.click(await screen.findByText(t.moderacao.denunciar));
        await userEvent.click(
            screen.getByLabelText(t.moderacao.razoes.spam),
        );
        await userEvent.type(
            screen.getByLabelText(t.moderacao.notaDaDenuncia),
            'Isto é publicidade a outro servidor.',
        );
        await userEvent.click(screen.getByText(t.moderacao.enviarDenuncia));

        await waitFor(() => {
            const denuncia = chamadas.mock.calls.find(([url]) =>
                String(url).includes('/market/listings/anuncio-1/reports'),
            );

            expect(denuncia).toBeDefined();

            expect(
                JSON.parse((denuncia?.[1] as { body: string }).body),
            ).toEqual({
                reason: 'spam',
                note: 'Isto é publicidade a outro servidor.',
            });
        });

        expect(
            await screen.findByText(t.moderacao.denunciaRecebida),
        ).toBeDefined();
    });

    it('esconde os botões de fechar num anúncio já vendido', async () => {
        vi.stubGlobal(
            'fetch',
            responder({
                anuncio: {
                    status: 'sold',
                    closedAt: '2026-09-22T10:00:00.000Z',
                },
            }),
        );

        montarAnuncio();

        expect(await screen.findByText(t.mercado.retirar)).toBeDefined();
        expect(screen.queryByText(t.mercado.marcarVendido)).toBeNull();
        expect(screen.queryByText(t.mercado.editar)).toBeNull();
    });

    it('marca como vendido', async () => {
        const chamadas = responder();

        vi.stubGlobal('fetch', chamadas);

        montarAnuncio();

        await userEvent.click(await screen.findByText(t.mercado.marcarVendido));

        await waitFor(() => {
            const fecho = chamadas.mock.calls.find(([url]) =>
                String(url).includes('/close'),
            );

            expect(fecho).toBeDefined();

            expect(
                JSON.parse((fecho?.[1] as { body: string }).body),
            ).toEqual({ outcome: 'sold' });
        });
    });

    /**
     * A recusa da API é dita no idioma de quem lê, e não com a frase
     * portuguesa que a API devolve.
     */
    it('diz por palavras que só quem joga lá pode vender', async () => {
        vi.stubGlobal(
            'fetch',
            responder({
                aoCriar: json(403, {
                    code: 'NOT_ON_SERVER',
                    message: 'Só quem joga neste servidor pode anunciar.',
                }),
            }),
        );

        montarMercado();

        await userEvent.click(await screen.findByText(t.mercado.anunciar));

        await userEvent.type(
            screen.getByLabelText(t.mercado.tituloDoAnuncio),
            'Carro qualquer',
        );
        await userEvent.type(
            screen.getByLabelText(t.mercado.corpoDoAnuncio),
            'Uma descrição que chegue.',
        );
        await userEvent.type(screen.getByLabelText(t.mercado.preco), '1000');

        await userEvent.click(screen.getByText(t.mercado.publicar));

        expect(
            await screen.findByText(t.erros.NOT_ON_SERVER),
        ).toBeDefined();
    });
});
