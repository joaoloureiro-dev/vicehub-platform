import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AuthProvider } from '../src/auth/auth.context.js';
import { Avaliacoes } from '../src/market/components/avaliacoes.js';
import { FormularioDeAvaliacao } from '../src/market/components/formulario-de-avaliacao.js';
import { sessionStore } from '../src/lib/session.js';
import { montarEcra, t } from './helpers.js';

/**
 * As avaliações de uma venda.
 *
 * O que aqui se guarda é o que faz uma média valer alguma coisa:
 *
 * - **quem foi avaliado responde, mas não apaga** — uma média que o
 *   dono limpa não diz nada a ninguém;
 * - **sem avaliações não há média**, e não um zero, que é uma nota
 *   péssima e não é o que quem ainda não vendeu merece;
 * - **a promessa de que é pública é lida antes de se escrever**.
 */
const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const EU = { id: 'u1', email: 'quem@vicehub.test', username: 'quem' };

const AVALIACAO = {
    id: 'avaliacao-1',
    rating: 4,
    body: 'Entregou à hora combinada.' as string | null,
    reply: null as string | null,
    repliedAt: null as string | null,
    reviewer: { id: 'u2', username: 'ana', avatarUrl: null } as
        | { id: string; username: string; avatarUrl: null }
        | null,
    listing: { id: 'anuncio-1', title: 'Banshee 900R' },
    createdAt: '2026-09-24T10:00:00.000Z',
};

/** Nomeia cada rota que o ecrã usa, e rebenta nas outras. */
const responder = (
    opcoes: {
        avaliacoes?: (typeof AVALIACAO)[];
        resumo?: { average: number | null; count: number };
        semSessao?: boolean;
        aoAvaliar?: Response;
    } = {},
) =>
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

        if (endereco.includes('/market/reviews/avaliacao-1/reply')) {
            return Promise.resolve(json(200, { id: 'avaliacao-1' }));
        }

        if (endereco.includes('/market/reviews/avaliacao-1')) {
            return Promise.resolve(json(204, null));
        }

        if (endereco.includes('/market/listings/anuncio-1/reviews')) {
            if (metodo === 'POST') {
                return Promise.resolve(
                    opcoes.aoAvaliar ?? json(201, { id: 'avaliacao-2' }),
                );
            }
        }

        if (endereco.includes('/market/people/ana/reviews')) {
            const lista = opcoes.avaliacoes ?? [AVALIACAO];

            return Promise.resolve(
                json(200, {
                    reviews: lista,
                    summary: opcoes.resumo ?? {
                        average: 4.3,
                        count: lista.length,
                    },
                    page: 1,
                    pages: 1,
                    total: lista.length,
                }),
            );
        }

        throw new Error(`rota não prevista no duplo: ${endereco}`);
    });

const montarAvaliacoes = (userId = 'u1') =>
    montarEcra(
        <AuthProvider>
            <Avaliacoes username="ana" userId={userId} />
        </AuthProvider>,
        '/u/ana',
    );

afterEach(() => {
    vi.unstubAllGlobals();
    sessionStore.clear();
});

describe('as avaliações de uma pessoa', () => {
    it('mostra a média e as notas', async () => {
        vi.stubGlobal('fetch', responder());

        montarAvaliacoes();

        expect(await screen.findByText(t.mercado.media(4.3, 1))).toBeDefined();
        expect(
            screen.getByText('Entregou à hora combinada.'),
        ).toBeDefined();
    });

    /**
     * Zero seria uma nota péssima, e quem ainda não vendeu nada não a
     * merece. Sem avaliações não há média nenhuma.
     */
    it('não inventa uma média a quem não tem avaliações', async () => {
        vi.stubGlobal(
            'fetch',
            responder({ avaliacoes: [], resumo: { average: null, count: 0 } }),
        );

        montarAvaliacoes();

        expect(await screen.findByText(t.mercado.semAvaliacoes)).toBeDefined();
        expect(screen.queryByText(/out of 5, from/)).toBeNull();
    });

    it('deixa responder quem foi avaliado', async () => {
        const chamadas = responder();

        vi.stubGlobal('fetch', chamadas);

        montarAvaliacoes('u1');

        await userEvent.click(
            await screen.findByText(t.mercado.responderAvaliacao),
        );

        await userEvent.type(
            screen.getByLabelText(t.mercado.aResposta),
            'Atrasei-me dez minutos.',
        );

        await userEvent.click(screen.getByText(t.mercado.enviarResposta));

        await waitFor(() => {
            const resposta = chamadas.mock.calls.find(([url]) =>
                String(url).includes('/market/reviews/avaliacao-1/reply'),
            );

            expect(resposta).toBeDefined();
        });
    });

    it('e não a mais ninguém', async () => {
        vi.stubGlobal('fetch', responder());

        montarAvaliacoes('u9');

        expect(await screen.findByText('Banshee 900R')).toBeDefined();
        expect(screen.queryByText(t.mercado.responderAvaliacao)).toBeNull();
    });

    /**
     * A regra que dá valor a uma média: quem foi avaliado não apaga a
     * nota que recebeu.
     */
    it('não dá a quem foi avaliado o botão de retirar', async () => {
        vi.stubGlobal('fetch', responder());

        montarAvaliacoes('u1');

        expect(await screen.findByText('Banshee 900R')).toBeDefined();
        expect(screen.queryByText(t.mercado.retirarAvaliacao)).toBeNull();
    });

    it('mas dá-o a quem a escreveu', async () => {
        vi.stubGlobal(
            'fetch',
            responder({
                avaliacoes: [
                    {
                        ...AVALIACAO,
                        reviewer: {
                            id: 'u1',
                            username: 'quem',
                            avatarUrl: null,
                        },
                    },
                ],
            }),
        );

        montarAvaliacoes('u9');

        expect(
            await screen.findByText(t.mercado.retirarAvaliacao),
        ).toBeDefined();
    });

    it('esconde a resposta depois de ela existir', async () => {
        vi.stubGlobal(
            'fetch',
            responder({
                avaliacoes: [
                    { ...AVALIACAO, reply: 'Atrasei-me, tens razão.' },
                ],
            }),
        );

        montarAvaliacoes('u1');

        expect(
            await screen.findByText('Atrasei-me, tens razão.'),
        ).toBeDefined();

        expect(screen.queryByText(t.mercado.responderAvaliacao)).toBeNull();
    });
});

describe('avaliar uma venda', () => {
    const montarFormulario = () =>
        montarEcra(
            <AuthProvider>
                <FormularioDeAvaliacao
                    listingId="anuncio-1"
                    aoAvaliar={() => undefined}
                />
            </AuthProvider>,
            '/mercado/anuncio-1',
        );

    /**
     * A promessa de que é pública tem de estar **antes** da caixa de
     * texto: depois de enviada já não avisa ninguém de nada.
     */
    it('avisa que é pública antes de se escrever', async () => {
        vi.stubGlobal('fetch', responder());

        montarFormulario();

        await userEvent.click(await screen.findByText(t.mercado.avaliar));

        const aviso = screen.getByText(t.mercado.avaliacaoPublica);
        const caixa = screen.getByLabelText(t.mercado.oComentario);

        expect(
            aviso.compareDocumentPosition(caixa)
            & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('manda a nota escolhida', async () => {
        const chamadas = responder();

        vi.stubGlobal('fetch', chamadas);

        montarFormulario();

        await userEvent.click(await screen.findByText(t.mercado.avaliar));
        await userEvent.click(screen.getByLabelText(t.mercado.estrelas(2)));
        await userEvent.click(screen.getByText(t.mercado.enviarAvaliacao));

        await waitFor(() => {
            const criada = chamadas.mock.calls.find(([url]) =>
                String(url).includes('/market/listings/anuncio-1/reviews'),
            );

            expect(criada).toBeDefined();

            expect(
                JSON.parse((criada?.[1] as { body: string }).body),
            ).toEqual({ rating: 2 });
        });
    });

    /**
     * Quem pode avaliar decide-se na API. A recusa é dita por palavras
     * e no idioma de quem lê — esconder o botão deixava a pessoa sem
     * saber o que lhe faltava.
     */
    it('diz por palavras que só avalia quem falou com quem vendeu', async () => {
        vi.stubGlobal(
            'fetch',
            responder({
                aoAvaliar: json(409, {
                    code: 'NO_DEAL',
                    message: 'Só avalia quem falou com quem vendeu.',
                }),
            }),
        );

        montarFormulario();

        await userEvent.click(await screen.findByText(t.mercado.avaliar));
        await userEvent.click(screen.getByText(t.mercado.enviarAvaliacao));

        expect(await screen.findByText(t.erros.NO_DEAL)).toBeDefined();
    });
});
