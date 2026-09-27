import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ForumPage } from '../src/forum/pages/forum.page.js';
import { AuthProvider } from '../src/auth/auth.context.js';
import { montarEcra, t } from './helpers.js';

/**
 * A caixa de procura do fórum, no ecrã.
 *
 * O que aqui se guarda não é que o filtro funciona — isso é da API e
 * tem o seu teste contra PostgreSQL. É o que o ecrã faz com ele:
 *
 * - que a procura vai no **endereço**, porque é o que a torna
 *   partilhável e o que faz o botão de voltar do browser desfazer a
 *   procura em vez de sair do fórum;
 * - que a lista vazia diz coisas diferentes consoante se procurou ou
 *   não. «Ainda não há perguntas» a quem procurou uma palavra é
 *   mentira, e deixa a pessoa a achar que o fórum está vazio quando o
 *   que está vazio é o resultado dela.
 */
const json = (body: unknown): Response =>
    ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as Response;

const pagina = (topicos: { id: string; title: string }[]) => ({
    topics: topicos.map((topico) => ({
        ...topico,
        excerpt: 'um excerto',
        author: { id: 'a', username: 'kestrel', avatarUrl: null },
        replyCount: 0,
        isLocked: false,
        createdAt: '2026-09-01T10:00:00.000Z',
        lastActivityAt: '2026-09-01T10:00:00.000Z',
    })),
    page: 1,
    pages: 1,
    total: topicos.length,
});

/**
 * O duplo nomeia as rotas que conhece e rebenta nas outras.
 *
 * Um duplo que responde a tudo o que lhe chega esconde um pedido a mais
 * — e um pedido a mais numa lista é o que faz a página piscar.
 */
const responder = (): ReturnType<typeof vi.fn> => {
    const chamadas = vi.fn((entrada: string) => {
        if (entrada.includes('/forum/topics?page=1&q=')) {
            const termo = decodeURIComponent(entrada.split('q=')[1] ?? '');

            return Promise.resolve(
                json(
                    termo === 'corridas'
                        ? pagina([{ id: '1', title: 'Noite de corridas' }])
                        : pagina([]),
                ),
            );
        }

        if (entrada.includes('/forum/topics?page=1')) {
            return Promise.resolve(
                json(pagina([
                    { id: '1', title: 'Noite de corridas' },
                    { id: '2', title: 'Onde se compram coletes' },
                ])),
            );
        }

        if (entrada.includes('/forum/moderation')) {
            return Promise.resolve(json({ canModerate: false }));
        }

        throw new Error(`pedido não previsto: ${entrada}`);
    });

    vi.stubGlobal('fetch', chamadas);

    return chamadas;
};

afterEach(() => {
    vi.unstubAllGlobals();
});

const abrir = (entrada = '/forum') =>
    montarEcra(<AuthProvider><ForumPage /></AuthProvider>, entrada);

describe('procurar no fórum', () => {
    it('mostra tudo quando não se procurou nada', async () => {
        responder();
        abrir();

        expect(await screen.findByText('Noite de corridas')).toBeTruthy();
        expect(screen.getByText('Onde se compram coletes')).toBeTruthy();
    });

    /**
     * O endereço é que manda, e não o que está escrito na caixa.
     *
     * Quem abre um link que outra pessoa mandou vê a mesma lista, e a
     * caixa já tem lá a palavra — senão, procurar de novo a partir dali
     * obrigava a escrevê-la outra vez.
     */
    it('lê a procura do endereço', async () => {
        responder();
        abrir('/forum?q=corridas');

        expect(await screen.findByText('Noite de corridas')).toBeTruthy();
        expect(screen.queryByText('Onde se compram coletes')).toBeNull();

        const caixa = screen.getByRole('searchbox') as HTMLInputElement;

        expect(caixa.value).toBe('corridas');
    });

    it('e escreve-a lá quando se procura', async () => {
        responder();
        abrir();

        await screen.findByText('Noite de corridas');

        await userEvent.type(screen.getByRole('searchbox'), 'corridas');
        await userEvent.click(
            screen.getByRole('button', { name: t.crews.botaoProcurar }),
        );

        await waitFor(() => {
            expect(screen.queryByText('Onde se compram coletes')).toBeNull();
        });

        expect(screen.getByText(t.forum.aProcurarPor('corridas'))).toBeTruthy();
    });

    /**
     * E uma procura sem nada diz que foi a procura que não encontrou, e
     * não que o fórum está vazio.
     */
    it('diz que não encontrou, e não que não há nada', async () => {
        responder();
        abrir('/forum?q=submarino');

        expect(await screen.findByText(t.forum.semResultados)).toBeTruthy();
        expect(screen.queryByText(t.forum.aindaSemPerguntas)).toBeNull();
    });

    it('e sem procura, diz que ainda não há perguntas', async () => {
        vi.stubGlobal('fetch', vi.fn((entrada: string) =>
            Promise.resolve(json(
                entrada.includes('/forum/moderation')
                    ? { canModerate: false }
                    : pagina([]),
            ))));

        abrir();

        expect(await screen.findByText(t.forum.aindaSemPerguntas)).toBeTruthy();
        expect(screen.queryByText(t.forum.semResultados)).toBeNull();
    });

    /** E há por onde sair da procura sem apagar a caixa à mão. */
    it('deixa limpar a procura', async () => {
        responder();
        abrir('/forum?q=corridas');

        await screen.findByText('Noite de corridas');

        await userEvent.click(
            screen.getByRole('button', { name: t.forum.limparProcura }),
        );

        expect(await screen.findByText('Onde se compram coletes')).toBeTruthy();
        expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('');
    });
});
