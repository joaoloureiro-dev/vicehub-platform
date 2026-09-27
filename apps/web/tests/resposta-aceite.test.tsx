import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

import { AuthProvider } from '../src/auth/auth.context.js';
import { TopicPage } from '../src/forum/pages/topic.page.js';
import { sessionStore } from '../src/lib/session.js';
import { montarEcra, t } from './helpers.js';

/**
 * Marcar a resposta que resolveu, no ecrã.
 *
 * A regra a sério é da API e tem o seu teste contra PostgreSQL. O que
 * aqui se guarda é a metade que só o ecrã pode errar:
 *
 * - o botão aparece a **quem perguntou** e a mais ninguém, nem a quem
 *   modera. Oferecer um botão que a API vai recusar é pior do que não
 *   o ter: quem carrega fica a achar que a plataforma está partida;
 * - a marca é uma **frase** e não um visto verde sozinho. Quem chega ao
 *   fórum pela primeira vez não conhece a convenção, e quem não vê
 *   cores não vê nada.
 */
const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const EU = 'u1';

const topico = (aceite: string | null, perguntei: boolean) => ({
    id: 'topico-1',
    title: 'Como divido os ganhos de um assalto?',
    body: 'Somos cinco e o líder quer levar mais.',
    author: { id: perguntei ? EU : 'u2', username: 'ana', avatarUrl: null },
    isLocked: false,
    createdAt: '2026-09-20T10:00:00.000Z',
    askedById: perguntei ? EU : 'u2',
    acceptedReplyId: aceite,
    replies: [
        {
            id: 'resposta-1',
            body: 'Confirmas as presenças e divides por participação.',
            author: { id: 'u3', username: 'bruno', avatarUrl: null },
            createdAt: '2026-09-20T11:00:00.000Z',
        },
        {
            id: 'resposta-2',
            body: 'Metade para o líder, sempre.',
            author: { id: 'u4', username: 'clara', avatarUrl: null },
            createdAt: '2026-09-20T12:00:00.000Z',
        },
    ],
});

/** O duplo nomeia cada rota e rebenta nas outras. */
const responder = (opcoes: {
    aceite?: string | null;
    perguntei?: boolean;
    modera?: boolean;
}) => {
    const chamadas = vi.fn((url: string, init?: { method?: string }) => {
        const endereco = String(url);

        if (endereco.endsWith('/auth/refresh')) {
            return Promise.resolve(
                json(200, {
                    accessToken: 'token',
                    user: { id: EU, email: 'eu@vicehub.test', username: 'eu' },
                }),
            );
        }

        if (endereco.endsWith('/forum/moderation')) {
            return Promise.resolve(json(200, { canModerate: opcoes.modera === true }));
        }

        if (endereco.includes('/accept')) {
            return Promise.resolve(json(204, null));
        }

        if (endereco.endsWith('/forum/topics/topico-1')) {
            return Promise.resolve(
                json(
                    200,
                    topico(opcoes.aceite ?? null, opcoes.perguntei !== false),
                ),
            );
        }

        throw new Error(`rota não prevista no duplo: ${endereco} ${init?.method ?? ''}`);
    });

    vi.stubGlobal('fetch', chamadas);

    return chamadas;
};

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

describe('a resposta que resolveu, no ecrã', () => {
    it('deixa quem perguntou marcar uma resposta', async () => {
        const chamadas = responder({});

        montar();

        const botoes = await screen.findAllByRole('button', {
            name: t.forum.marcarResposta,
        });

        expect(botoes).toHaveLength(2);

        await userEvent.click(botoes[0] as HTMLElement);

        await waitFor(() => {
            expect(
                chamadas.mock.calls.some(
                    ([endereco, init]) =>
                        String(endereco).includes('/forum/replies/resposta-1/accept')
                        && (init as { method?: string } | undefined)?.method === 'POST',
                ),
            ).toBe(true);
        });
    });

    /**
     * O caso que importa mais: quem não perguntou não vê um botão que a
     * API lhe vai recusar — e isso inclui quem modera, porque a resposta
     * que serviu é um facto de quem tinha o problema.
     */
    it.each([
        ['quem só passou por ali', { perguntei: false }],
        ['nem a quem modera', { perguntei: false, modera: true }],
    ])('e não o mostra a %s', async (_nome, opcoes) => {
        responder(opcoes);

        montar();

        await screen.findByText('Como divido os ganhos de um assalto?');

        expect(screen.queryByRole('button', { name: t.forum.marcarResposta })).toBeNull();
        expect(
            screen.queryByRole('button', { name: t.forum.desmarcarResposta }),
        ).toBeNull();
    });

    /** E a marcada diz que é a marcada, por escrito. */
    it('mostra a marca na resposta aceite, e só nela', async () => {
        responder({ aceite: 'resposta-1' });

        montar();

        const marcas = await screen.findAllByText(t.forum.respostaAceite);

        expect(marcas).toHaveLength(1);
    });

    it('e a marca aparece a quem nem perguntou', async () => {
        responder({ aceite: 'resposta-1', perguntei: false });

        montar();

        expect(await screen.findByText(t.forum.respostaAceite)).toBeTruthy();
    });

    /** E o botão da marcada desfaz, em vez de marcar outra vez. */
    it('e o botão da marcada passa a desmarcar', async () => {
        const chamadas = responder({ aceite: 'resposta-1' });

        montar();

        await userEvent.click(
            await screen.findByRole('button', { name: t.forum.desmarcarResposta }),
        );

        await waitFor(() => {
            expect(
                chamadas.mock.calls.some(
                    ([endereco, init]) =>
                        String(endereco).includes('/forum/replies/resposta-1/accept')
                        && (init as { method?: string } | undefined)?.method === 'DELETE',
                ),
            ).toBe(true);
        });

        /* E a outra continua a oferecer marcar, não desmarcar. */
        expect(
            screen.getAllByRole('button', { name: t.forum.marcarResposta }),
        ).toHaveLength(1);
    });
});
