import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

import { AuthProvider } from '../src/auth/auth.context.js';
import { ConversaPage } from '../src/market/pages/conversa.page.js';
import { ConversasPage } from '../src/market/pages/conversas.page.js';
import { sessionStore } from '../src/lib/session.js';
import { montarEcra, t } from './helpers.js';

/**
 * As conversas do mercado.
 *
 * O que aqui se guarda é o que uma conversa privada obriga o ecrã a
 * fazer:
 *
 * - **o aviso de que é privada aparece antes de se escrever**, e não
 *   depois: é a espécie de coisa que se tem o direito de saber a tempo;
 * - **denunciar é da outra pessoa, retirar é de quem escreveu** — os
 *   dois botões nunca aparecem na mesma mensagem;
 * - **uma mensagem vazia é o texto de quem apagou a conta**, e lê-se
 *   como isso em vez de como um espaço em branco.
 */
const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const EU = { id: 'u1', email: 'quem@vicehub.test', username: 'quem' };

const OUTRA = { id: 'u2', username: 'ana', avatarUrl: null };

const CONVERSA: {
    id: string;
    listing: {
        id: string;
        title: string;
        price: string;
        status: 'open' | 'sold' | 'withdrawn';
        isRemoved: boolean;
    };
    buyer: { id: string; username: string; avatarUrl: null } | null;
    seller: { id: string; username: string; avatarUrl: null } | null;
    messages: {
        id: string;
        body: string;
        sender: { id: string; username: string; avatarUrl: null } | null;
        isMine: boolean;
        createdAt: string;
    }[];
} = {
    id: 'conversa-1',
    listing: {
        id: 'anuncio-1',
        title: 'Banshee 900R',
        price: '250000',
        status: 'open',
        isRemoved: false,
    },
    buyer: { id: 'u1', username: 'quem', avatarUrl: null },
    seller: OUTRA,
    messages: [
        {
            id: 'mensagem-1',
            body: 'A que horas entregas?',
            sender: { id: 'u1', username: 'quem', avatarUrl: null },
            isMine: true,
            createdAt: '2026-09-24T10:00:00.000Z',
        },
        {
            id: 'mensagem-2',
            body: 'Depois das oito, no porto.',
            sender: OUTRA,
            isMine: false,
            createdAt: '2026-09-24T10:05:00.000Z',
        },
    ],
};

/** Nomeia cada rota que o ecrã usa, e rebenta nas outras. */
const responder = (
    opcoes: {
        conversa?: Partial<typeof CONVERSA>;
        caixa?: unknown[];
        recusada?: boolean;
    } = {},
) =>
    vi.fn((url: string, init?: { method?: string }) => {
        const endereco = String(url);
        const metodo = init?.method ?? 'GET';

        if (endereco.endsWith('/auth/refresh')) {
            return Promise.resolve(
                json(200, { accessToken: 'token', user: EU }),
            );
        }

        if (endereco.includes('/market/messages/') && metodo === 'DELETE') {
            return Promise.resolve(json(204, null));
        }

        if (endereco.includes('/market/messages/')) {
            return Promise.resolve(json(201, { id: 'denuncia-1' }));
        }

        if (endereco.includes('/market/conversations/conversa-1/messages')) {
            return Promise.resolve(json(201, { id: 'mensagem-3' }));
        }

        if (endereco.includes('/market/conversations/conversa-1')) {
            if (opcoes.recusada === true) {
                return Promise.resolve(
                    json(404, { code: 'CONVERSATION_NOT_FOUND' }),
                );
            }

            return Promise.resolve(
                json(200, { ...CONVERSA, ...opcoes.conversa }),
            );
        }

        if (endereco.includes('/market/conversations')) {
            const lista = opcoes.caixa ?? [
                {
                    id: 'conversa-1',
                    listing: CONVERSA.listing,
                    comQuem: OUTRA,
                    ultima: {
                        body: 'Depois das oito, no porto.',
                        isMine: false,
                        createdAt: '2026-09-24T10:05:00.000Z',
                    },
                    updatedAt: '2026-09-24T10:05:00.000Z',
                },
            ];

            return Promise.resolve(
                json(200, {
                    conversations: lista,
                    page: 1,
                    pages: 1,
                    total: lista.length,
                }),
            );
        }

        throw new Error(`rota não prevista no duplo: ${endereco}`);
    });

const montarConversa = () =>
    montarEcra(
        <AuthProvider>
            <Routes>
                <Route
                    path="/mercado/conversas/:conversationId"
                    element={<ConversaPage />}
                />
            </Routes>
        </AuthProvider>,
        '/mercado/conversas/conversa-1',
    );

const montarCaixa = () =>
    montarEcra(
        <AuthProvider>
            <ConversasPage />
        </AuthProvider>,
        '/mercado/conversas',
    );

afterEach(() => {
    vi.unstubAllGlobals();
    sessionStore.clear();
});

describe('a caixa de entrada do mercado', () => {
    it('mostra com quem se está a falar, e sobre o quê', async () => {
        vi.stubGlobal('fetch', responder());

        montarCaixa();

        expect(await screen.findByText('ana')).toBeDefined();
        expect(screen.getByText(/Banshee 900R/)).toBeDefined();
        expect(screen.getByText('Depois das oito, no porto.')).toBeDefined();
    });

    /**
     * A caixa de entrada tem muitas conversas, e a frase tem de falar
     * delas no plural: "esta conversa" numa lista é uma frase a olhar
     * para o sítio errado. Só se viu a olhar para o ecrã.
     */
    it('diz que as conversas são privadas, no plural', async () => {
        vi.stubGlobal('fetch', responder());

        montarCaixa();

        expect(
            await screen.findByText(t.mercado.conversasPrivadas),
        ).toBeDefined();

        expect(screen.queryByText(t.mercado.conversaPrivada)).toBeNull();
    });

    it('e mostra o vazio de quem ainda não falou com ninguém', async () => {
        vi.stubGlobal('fetch', responder({ caixa: [] }));

        montarCaixa();

        expect(await screen.findByText(t.mercado.semConversas)).toBeDefined();
    });
});

describe('uma conversa', () => {
    /**
     * O aviso tem de estar **antes** da caixa de escrita: depois de se
     * escrever já não serve de nada.
     */
    it('avisa que é privada antes de se escrever', async () => {
        vi.stubGlobal('fetch', responder());

        montarConversa();

        const aviso = await screen.findByText(t.mercado.conversaPrivada);
        const caixa = screen.getByLabelText(t.mercado.escreverMensagem);

        expect(
            aviso.compareDocumentPosition(caixa)
            & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('mostra as duas mensagens', async () => {
        vi.stubGlobal('fetch', responder());

        montarConversa();

        expect(await screen.findByText('A que horas entregas?')).toBeDefined();
        expect(screen.getByText('Depois das oito, no porto.')).toBeDefined();
    });

    it('envia o que se escreve', async () => {
        const chamadas = responder();

        vi.stubGlobal('fetch', chamadas);

        montarConversa();

        await userEvent.type(
            await screen.findByLabelText(t.mercado.escreverMensagem),
            'Combinado.',
        );

        await userEvent.click(screen.getByText(t.mercado.enviarMensagem));

        await waitFor(() => {
            const envio = chamadas.mock.calls.find(([url]) =>
                String(url).includes('/conversations/conversa-1/messages'),
            );

            expect(envio).toBeDefined();

            expect(
                JSON.parse((envio?.[1] as { body: string }).body),
            ).toEqual({ body: 'Combinado.' });
        });
    });

    /**
     * Os dois botões nunca aparecem na mesma mensagem: retirar o que é
     * meu, denunciar o que é da outra pessoa.
     */
    it('dá a retirar o que é meu e a denunciar o que não é', async () => {
        vi.stubGlobal('fetch', responder());

        montarConversa();

        expect(
            await screen.findByText(t.mercado.retirarMensagem),
        ).toBeDefined();

        expect(screen.getAllByText(t.moderacao.denunciar)).toHaveLength(1);
        expect(
            screen.getAllByText(t.mercado.retirarMensagem),
        ).toHaveLength(1);
    });

    it('denuncia a mensagem da outra pessoa', async () => {
        const chamadas = responder();

        vi.stubGlobal('fetch', chamadas);

        montarConversa();

        await userEvent.click(await screen.findByText(t.moderacao.denunciar));
        await userEvent.click(screen.getByLabelText(t.moderacao.razoes.abuse));
        await userEvent.click(screen.getByText(t.moderacao.enviarDenuncia));

        await waitFor(() => {
            const denuncia = chamadas.mock.calls.find(([url]) =>
                String(url).includes('/market/messages/mensagem-2/reports'),
            );

            expect(denuncia).toBeDefined();
        });
    });

    /**
     * Uma mensagem vazia é o texto de quem apagou a conta. Mostrá-la em
     * branco deixava a conversa com um buraco sem explicação.
     */
    it('diz que uma mensagem vazia saiu com a conta', async () => {
        vi.stubGlobal(
            'fetch',
            responder({
                conversa: {
                    messages: [
                        {
                            id: 'mensagem-2',
                            body: '',
                            sender: null,
                            isMine: false,
                            createdAt: '2026-09-24T10:05:00.000Z',
                        },
                    ],
                },
            }),
        );

        montarConversa();

        expect(
            await screen.findByText(t.mercado.retiradaComAConta),
        ).toBeDefined();
    });

    /**
     * Um anúncio retirado fecha a conversa a mensagens novas: a API
     * recusa, e um campo que aceita texto para depois o perder é pior
     * do que um campo que não está lá.
     */
    it('fecha a escrita quando o anúncio foi retirado', async () => {
        vi.stubGlobal(
            'fetch',
            responder({
                conversa: {
                    listing: { ...CONVERSA.listing, isRemoved: true },
                },
            }),
        );

        montarConversa();

        expect(
            await screen.findByText(t.mercado.anuncioRetirado),
        ).toBeDefined();

        expect(
            screen.queryByLabelText(t.mercado.escreverMensagem),
        ).toBeNull();
    });

    /**
     * A quem não está na conversa, a API responde o mesmo que a uma
     * conversa que não existe — e o ecrã mostra isso tal e qual.
     */
    it('não diz a um estranho que a conversa existe', async () => {
        vi.stubGlobal('fetch', responder({ recusada: true }));

        montarConversa();

        expect(
            await screen.findByText(t.erros.CONVERSATION_NOT_FOUND),
        ).toBeDefined();

        expect(screen.queryByText('A que horas entregas?')).toBeNull();
    });
});
