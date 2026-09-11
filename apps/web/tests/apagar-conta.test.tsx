import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApagarConta } from '../src/profile/components/apagar-conta.js';
import { sessionStore } from '../src/lib/session.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

/** O corpo com que o pedido de eliminação foi feito. */
const corpoDoPedido = (fetchMock: ReturnType<typeof vi.fn>): unknown => {
    const chamada = fetchMock.mock.calls.find((argumentos) =>
        String(argumentos[0]).endsWith('/users/me'),
    );

    return JSON.parse(
        String((chamada?.[1] as { body?: string } | undefined)?.body ?? '{}'),
    );
};

const servidor = (resposta = json(204, null)) =>
    vi.fn((_url: string) => Promise.resolve(resposta));

afterEach(() => {
    vi.unstubAllGlobals();
});

/**
 * Apagar a conta.
 *
 * Duas coisas a guardar: **não se apaga por engano** — o botão não
 * funciona até o nome estar escrito certo — e **o que a API recusa é
 * dito tal como ela o diz**, porque é aí que está a única parte
 * acionável da resposta.
 */
describe('apagar a conta', () => {
    it('o botão não faz nada até o nome estar certo', async () => {
        const fetchMock = servidor();
        vi.stubGlobal('fetch', fetchMock);

        montarEcra(<ApagarConta username="player" />);

        const botao = screen.getByText(t.perfil.apagarContaConfirmar);

        expect(botao).toHaveProperty('disabled', true);

        await userEvent.type(
            screen.getByLabelText(t.zonaPerigo.confirmacao),
            'playe',
        );

        expect(botao).toHaveProperty('disabled', true);

        await userEvent.type(
            screen.getByLabelText(t.zonaPerigo.confirmacao),
            'r',
        );

        expect(botao).toHaveProperty('disabled', false);
    });

    it('apaga e leva a pessoa para fora', async () => {
        const fetchMock = servidor();
        vi.stubGlobal('fetch', fetchMock);

        /**
         * Com alguém lá dentro de propósito. Sem isto, a asserção do
         * fim era vazia: o store já estava vazio antes de se apagar
         * fosse o que fosse, e passava com ou sem a limpeza.
         */
        sessionStore.set('token-de-teste', {
            id: 'u1',
            email: 'player@vicehub.test',
            username: 'player',
        });

        montarEcra(<ApagarConta username="player" />);

        await userEvent.type(
            screen.getByLabelText(t.zonaPerigo.confirmacao),
            'player',
        );
        await userEvent.type(
            screen.getByLabelText(t.perfil.apagarContaPassword),
            'Sup3rS3cret!Pass',
        );
        await userEvent.click(screen.getByText(t.perfil.apagarContaConfirmar));

        await waitFor(() => {
            expect(corpoDoPedido(fetchMock)).toEqual({
                confirmation: 'player',
                password: 'Sup3rS3cret!Pass',
            });
        });

        /** E a aplicação deixa de achar que há alguém dentro. */
        expect(sessionStore.getUser()).toBeNull();
    });

    /**
     * Quem entra pelo Discord ou pela Google não tem password nenhuma.
     * Mandar uma string vazia fazia a API procurar uma password que não
     * existe, e recusar por isso a quem não tem culpa.
     */
    it('não manda password nenhuma quando o campo fica vazio', async () => {
        const fetchMock = servidor();
        vi.stubGlobal('fetch', fetchMock);

        montarEcra(<ApagarConta username="player" />);

        await userEvent.type(
            screen.getByLabelText(t.zonaPerigo.confirmacao),
            'player',
        );
        await userEvent.click(screen.getByText(t.perfil.apagarContaConfirmar));

        await waitFor(() => {
            expect(corpoDoPedido(fetchMock)).toEqual({ confirmation: 'player' });
        });
    });

    /**
     * **A recusa da API é dita tal como ela a diz.**
     *
     * "Não foi possível" era deitar fora a única parte útil: qual é a
     * crew que fica sem dono, e portanto o que há a fazer primeiro.
     */
    it('mostra o que a API diz que falta fazer primeiro', async () => {
        vi.stubGlobal(
            'fetch',
            servidor(
                json(409, {
                    code: 'ACCOUNT_LEADS_COMMUNITIES',
                    message:
                        'És a única pessoa que manda em: Vice Kings. Passa o cargo a outra pessoa.',
                }),
            ),
        );

        montarEcra(<ApagarConta username="player" />);

        await userEvent.type(
            screen.getByLabelText(t.zonaPerigo.confirmacao),
            'player',
        );
        await userEvent.click(screen.getByText(t.perfil.apagarContaConfirmar));

        expect(await screen.findByText(/Vice Kings/)).toBeTruthy();

        /** E a sessão não é limpa: não se apagou nada. */
        expect(screen.getByText(t.perfil.apagarContaConfirmar)).toBeTruthy();
    });

    /**
     * A explicação do que sai e do que fica está à vista antes de
     * qualquer clique. Uma decisão irreversível explicada só depois de
     * tomada não é uma decisão informada.
     */
    it('diz o que sai e o que fica antes de qualquer clique', () => {
        vi.stubGlobal('fetch', servidor());

        montarEcra(<ApagarConta username="player" />);

        expect(screen.getByText(t.perfil.apagarContaFica)).toBeTruthy();
        expect(screen.getByText(t.perfil.apagarContaExplicacao)).toBeTruthy();
    });
});
