import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BotaoDeAmizade } from '../src/profile/components/botao-de-amizade.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const pessoa = {
    userId: 'u-2',
    username: 'bruno',
    avatarUrl: null,
    level: 3,
    since: '2026-02-01T00:00:00.000Z',
};

const metodoUsado = (fetchMock: ReturnType<typeof vi.fn>): string | undefined =>
    (fetchMock.mock.calls.at(-1)?.[1] as { method?: string } | undefined)?.method;

const urlUsada = (fetchMock: ReturnType<typeof vi.fn>): string =>
    String(fetchMock.mock.calls.at(-1)?.[0] ?? '');

afterEach(() => {
    vi.unstubAllGlobals();
});

/**
 * O botão de amizade.
 *
 * Quatro estados, e cada um oferece uma coisa só. O que aqui interessa
 * provar é que o estado sai das listas que a API devolve — e não de um
 * palpite — e que cada botão faz o pedido certo: aceitar e retirar
 * parecem-se no ecrã e são coisas diferentes na API.
 */
describe('o botão de amizade', () => {
    const montar = (
        amigos: typeof pessoa[] | null,
        pedidos: (typeof pessoa & { direction: 'incoming' | 'outgoing' })[] | null,
    ) =>
        montarEcra(
            <BotaoDeAmizade
                userId="u-2"
                amigos={amigos}
                pedidos={pedidos}
                aoMudar={() => {}}
            />,
        );

    /** Um botão que diz a coisa errada por meio segundo é pior do que nenhum. */
    it('não mostra nada enquanto as listas não chegam', () => {
        const { container } = montar(null, null);

        expect(container.textContent).toBe('');
    });

    it('oferece adicionar a quem não tem relação nenhuma', async () => {
        const fetchMock = vi.fn(() => Promise.resolve(json(201, {})));

        vi.stubGlobal('fetch', fetchMock);
        montar([], []);

        await userEvent.click(
            screen.getByRole('button', { name: t.amigos.adicionar }),
        );

        await waitFor(() => {
            expect(metodoUsado(fetchMock)).toBe('POST');
        });

        expect(urlUsada(fetchMock)).toContain('/friends/u-2');
        expect(urlUsada(fetchMock)).not.toContain('accept');
    });

    it('oferece aceitar e recusar um pedido que me fizeram', async () => {
        const fetchMock = vi.fn(() => Promise.resolve(json(204, {})));

        vi.stubGlobal('fetch', fetchMock);
        montar([], [{ ...pessoa, direction: 'incoming' }]);

        expect(
            screen.queryByRole('button', { name: t.amigos.adicionar }),
        ).toBeNull();

        await userEvent.click(
            screen.getByRole('button', { name: t.amigos.aceitar }),
        );

        await waitFor(() => {
            expect(urlUsada(fetchMock)).toContain('/friends/u-2/accept');
        });
    });

    /**
     * Um pedido meu está à espera da outra pessoa. Oferecer "aceitar"
     * aqui seria deixar-me aceitar-me a mim próprio — coisa que a API
     * recusa e que o ecrã não deve sequer mostrar.
     */
    it('num pedido meu só oferece retirar', async () => {
        const fetchMock = vi.fn(() => Promise.resolve(json(204, {})));

        vi.stubGlobal('fetch', fetchMock);
        montar([], [{ ...pessoa, direction: 'outgoing' }]);

        expect(screen.getByText(t.amigos.pedidoEnviado)).toBeDefined();
        expect(screen.queryByRole('button', { name: t.amigos.aceitar })).toBeNull();

        await userEvent.click(
            screen.getByRole('button', { name: t.amigos.retirar }),
        );

        await waitFor(() => {
            expect(metodoUsado(fetchMock)).toBe('DELETE');
        });
    });

    it('a quem já é amigo oferece desfazer', async () => {
        const fetchMock = vi.fn(() => Promise.resolve(json(204, {})));

        vi.stubGlobal('fetch', fetchMock);
        montar([pessoa], []);

        expect(screen.getByText(t.amigos.saoAmigos)).toBeDefined();

        await userEvent.click(
            screen.getByRole('button', { name: t.amigos.desfazer }),
        );

        await waitFor(() => {
            expect(metodoUsado(fetchMock)).toBe('DELETE');
        });
    });

    /** A recusa da API é uma frase útil; não se troca por "não foi possível". */
    /**
     * A API responde em português. O ecrã não.
     *
     * Este teste dizia o contrário: afirmava que a frase da API aparecia
     * tal e qual, e foi assim que uma pessoa a usar a plataforma em
     * inglês acabou a ler português — o comportamento estava fixado como
     * se fosse uma funcionalidade.
     *
     * A suite corre em inglês, por isso as duas frases são diferentes o
     * suficiente para não haver dúvida sobre qual delas chegou ao ecrã.
     */
    it('diz no idioma de quem lê, e não no da API', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve(
                    json(409, {
                        code: 'ALREADY_FRIENDS',
                        message: 'Já são amigos.',
                    }),
                ),
            ),
        );

        montar([], []);

        await userEvent.click(
            screen.getByRole('button', { name: t.amigos.adicionar }),
        );

        const aviso = await screen.findByRole('alert');

        expect(aviso.textContent).toBe(t.erros.ALREADY_FRIENDS);
        expect(aviso.textContent).not.toBe('Já são amigos.');
    });
});
