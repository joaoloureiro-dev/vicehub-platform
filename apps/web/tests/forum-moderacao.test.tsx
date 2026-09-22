import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

import { AuthProvider } from '../src/auth/auth.context.js';
import { TopicPage } from '../src/forum/pages/topic.page.js';
import { sessionStore } from '../src/lib/session.js';
import { montarEcra, t } from './helpers.js';

/**
 * As ferramentas de moderação, no ecrã.
 *
 * Existiam na API desde que o fórum abriu e **não tinham interface
 * nenhuma**: nenhum botão em lado nenhum, e a única forma de moderar
 * era falar com a API à mão. O que aqui se guarda é que elas aparecem a
 * quem as tem — e, mais importante, que não aparecem a quem não as tem.
 *
 * A decisão a sério continua a ser da API. O ecrã só evita oferecer o
 * que de certeza vai ser recusado.
 */
const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const TOPICO = {
    id: 'topico-1',
    title: 'Como divido os ganhos de um assalto?',
    body: 'Somos cinco e o líder quer levar mais.',
    author: { id: 'u2', username: 'ana', avatarUrl: null },
    isLocked: false,
    createdAt: '2026-09-20T10:00:00.000Z',
    replies: [
        {
            id: 'resposta-1',
            body: 'Confirmas as presenças e divides por participação.',
            author: { id: 'u3', username: 'bruno', avatarUrl: null },
            createdAt: '2026-09-20T11:00:00.000Z',
        },
    ],
};

/**
 * O duplo nomeia cada rota que o ecrã usa e **rebenta** nas outras.
 *
 * Um duplo que responda a tudo faz o teste passar sobre um ecrã que
 * passou a falar com outro sítio qualquer.
 */
const responder = (opcoes: {
    modera: boolean;
    /** Com sessão, por omissão: sem ela não há moderação a mostrar. */
    comSessao?: boolean;
    topico?: typeof TOPICO;
}) =>
    vi.fn((url: string, init?: { method?: string }) => {
        const endereco = String(url);

        /*
         * O AuthProvider troca o cookie por um access token ao arrancar.
         * Sem esta rota o contexto ficava sem utilizador, e um teste
         * passava pela razão errada: os botões faltavam por não haver
         * sessão, e não por falta de permissão.
         */
        if (endereco.endsWith('/auth/refresh')) {
            return Promise.resolve(
                opcoes.comSessao === false
                    ? json(401, { code: 'UNAUTHORIZED' })
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

        if (endereco.endsWith('/forum/moderation')) {
            return Promise.resolve(json(200, { canModerate: opcoes.modera }));
        }

        if (endereco.includes('/forum/topics/topico-1/lock')) {
            return Promise.resolve(json(204, null));
        }

        if (endereco.endsWith('/forum/topics/topico-1')) {
            if (init?.method === 'DELETE') {
                return Promise.resolve(json(204, null));
            }

            return Promise.resolve(json(200, opcoes.topico ?? TOPICO));
        }

        if (endereco.endsWith('/forum/replies/resposta-1')) {
            return Promise.resolve(json(204, null));
        }

        throw new Error(`rota não prevista no duplo: ${endereco}`);
    });

const montar = () =>
    montarEcra(
        <AuthProvider>
            <Routes>
                <Route path="/forum/:topicId" element={<TopicPage />} />
            </Routes>
        </AuthProvider>,
        '/forum/topico-1',
    );

afterEach(() => {
    vi.unstubAllGlobals();
    sessionStore.clear();
});

describe('moderar uma pergunta do fórum', () => {
    it('mostra o botão de fechar a quem modera', async () => {
        vi.stubGlobal('fetch', responder({ modera: true }));

        montar();

        expect(await screen.findByText(t.forum.fechar)).toBeDefined();
    });

    /**
     * O caso que importa mais: quem não modera não vê uma ferramenta
     * que a API lhe vai recusar.
     */
    it('não mostra nada disso a quem não modera', async () => {
        vi.stubGlobal('fetch', responder({ modera: false }));

        montar();

        await screen.findByText(TOPICO.title);

        expect(screen.queryByText(t.forum.fechar)).toBeNull();
        expect(screen.queryByText(t.forum.reabrir)).toBeNull();
        expect(screen.queryByText(t.forum.retirar)).toBeNull();
    });

    /**
     * E a quem não tem sessão nem se chega a perguntar.
     *
     * A rota exige uma, e a resposta para quem não a tem já se sabe.
     * Perguntar na mesma dava um 401 a cada visita anónima — que é a
     * visita mais comum que o fórum tem, porque quem chega de uma
     * pesquisa chega sem conta.
     */
    it('não mostra nada disso a quem nem sessão tem, e nem pergunta', async () => {
        const chamadas = responder({ modera: false, comSessao: false });

        vi.stubGlobal('fetch', chamadas);

        montar();

        await screen.findByText(TOPICO.title);

        expect(screen.queryByText(t.forum.fechar)).toBeNull();
        expect(screen.queryByText(t.forum.retirar)).toBeNull();

        expect(
            chamadas.mock.calls.some(([endereco]) =>
                String(endereco).endsWith('/forum/moderation'),
            ),
        ).toBe(false);
    });

    it('fecha a pergunta quando o botão é premido', async () => {
        const chamadas = responder({ modera: true });

        vi.stubGlobal('fetch', chamadas);

        montar();

        await userEvent.click(await screen.findByText(t.forum.fechar));

        await waitFor(() => {
            const pedido = chamadas.mock.calls.find(([endereco]) =>
                String(endereco).includes('/lock'),
            );

            expect(pedido).toBeDefined();
            expect((pedido?.[1] as { method?: string }).method).toBe('POST');
        });
    });

    /**
     * Numa pergunta já fechada o botão é o outro, e o pedido é o outro.
     * Um botão que dissesse "fechar" numa conversa fechada mandava o
     * moderador fechá-la outra vez sem nada mudar.
     */
    it('oferece reabrir quando a pergunta está fechada', async () => {
        const chamadas = responder({
            modera: true,
            topico: { ...TOPICO, isLocked: true },
        });

        vi.stubGlobal('fetch', chamadas);

        montar();

        await userEvent.click(await screen.findByText(t.forum.reabrir));

        await waitFor(() => {
            const pedido = chamadas.mock.calls.find(([endereco]) =>
                String(endereco).includes('/lock'),
            );

            expect((pedido?.[1] as { method?: string }).method).toBe('DELETE');
        });
    });

    /**
     * E quem modera também pode retirar o que outra pessoa escreveu —
     * que é a outra metade da moderação, e a que existia na API sem
     * botão nenhum a chamá-la.
     */
    it('deixa quem modera retirar o texto de outra pessoa', async () => {
        const chamadas = responder({ modera: true });

        vi.stubGlobal('fetch', chamadas);

        montar();

        const botoes = await screen.findAllByText(t.forum.retirar);

        /** Um para a pergunta, outro para a resposta de outra pessoa. */
        expect(botoes).toHaveLength(2);

        await userEvent.click(botoes[1] as HTMLElement);

        await waitFor(() => {
            const pedido = chamadas.mock.calls.find(([endereco]) =>
                String(endereco).includes('/forum/replies/'),
            );

            expect((pedido?.[1] as { method?: string }).method).toBe('DELETE');
        });
    });
});
