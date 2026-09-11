import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LevarDados } from '../src/profile/components/levar-dados.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const EXPORTACAO = {
    format: 'vicehub.account.v1',
    account: { username: 'player', email: 'player@vicehub.test' },
    profile: { xp: '9007199254740993' },
};

/** O jsdom não monta ficheiros: as duas pontas do download são fingidas. */
const criarObjectURL = vi.fn(() => 'blob:vicehub/1');
const revokeObjectURL = vi.fn();
let descarregado: { download: string; clicado: boolean } | null = null;

beforeEach(() => {
    descarregado = null;
    criarObjectURL.mockClear();
    revokeObjectURL.mockClear();

    vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: criarObjectURL,
        revokeObjectURL,
    });

    /**
     * O clique numa âncora com `download` não faz nada no jsdom e avisa
     * na consola. Substituí-lo é o que permite ver **o nome com que o
     * ficheiro sairia**, que é a parte que interessa.
     */
    const criarOriginal = document.createElement.bind(document);

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const elemento = criarOriginal(tag) as HTMLAnchorElement;

        if (tag === 'a') {
            elemento.click = () => {
                descarregado = {
                    download: elemento.download,
                    clicado: true,
                };
            };
        }

        return elemento;
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

/**
 * Levar os dados consigo.
 *
 * O ficheiro é montado no browser e não pedido como link: a rota exige
 * o token da sessão, e um `<a href>` não o leva — abria um 401 num
 * separador em branco.
 */
describe('levar os dados', () => {
    it('pede a exportação e entrega um ficheiro com o nome da conta', async () => {
        const fetchMock = vi.fn((_url: string) =>
            Promise.resolve(json(200, EXPORTACAO)),
        );

        vi.stubGlobal('fetch', fetchMock);

        montarEcra(<LevarDados />);

        await userEvent.click(screen.getByText(t.perfil.levarDadosBotao));

        await waitFor(() => {
            expect(descarregado?.clicado).toBe(true);
        });

        expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
            '/users/me/export',
        );
        expect(descarregado?.download).toContain('player');
        expect(descarregado?.download.endsWith('.json')).toBe(true);
    });

    /**
     * Sem isto, o ficheiro ficava preso na memória do separador até ele
     * fechar — e uma exportação são dezenas de kilobytes que ninguém
     * volta a usar.
     */
    it('liberta o ficheiro da memória depois de o entregar', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn((_url: string) => Promise.resolve(json(200, EXPORTACAO))),
        );

        montarEcra(<LevarDados />);

        await userEvent.click(screen.getByText(t.perfil.levarDadosBotao));

        await waitFor(() => {
            expect(revokeObjectURL).toHaveBeenCalledWith('blob:vicehub/1');
        });
    });

    it('diz que não conseguiu, em vez de não fazer nada', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn((_url: string) => Promise.reject(new Error('sem rede'))),
        );

        montarEcra(<LevarDados />);

        await userEvent.click(screen.getByText(t.perfil.levarDadosBotao));

        expect(
            await screen.findByText(t.perfil.levarDadosFalhou),
        ).toBeTruthy();

        /** E o botão volta a poder ser carregado. */
        expect(
            screen.getByText(t.perfil.levarDadosBotao),
        ).toHaveProperty('disabled', false);
    });

    /**
     * A explicação diz o que vai no ficheiro **e o que não vai**. A
     * segunda metade é a que evita a pergunta que toda a gente faz a
     * seguir: "isto leva a minha password?"
     */
    it('explica o que leva antes de qualquer clique', () => {
        vi.stubGlobal('fetch', vi.fn());

        montarEcra(<LevarDados />);

        expect(screen.getByText(t.perfil.levarDadosExplicacao)).toBeTruthy();
    });
});
