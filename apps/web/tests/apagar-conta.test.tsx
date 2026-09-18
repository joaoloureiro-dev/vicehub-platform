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

/**
 * `carteira` é o saldo que a rota do saldo devolve. Por omissão zero:
 * o aviso de o perder é assunto dos testes que o medem, e pô-lo em
 * todos punha texto a mais onde ele não é o que está a ser testado.
 */
const servidor = (resposta = json(204, null), carteira = '0') =>
    vi.fn((url: string) => {
        if (String(url).endsWith('/treasury/me')) {
            return Promise.resolve(
                json(200, {
                    balances: {
                        settled: carteira,
                        pendingIn: '0',
                        pendingOut: '0',
                        available: carteira,
                    },
                    movements: [],
                }),
            );
        }

        return Promise.resolve(resposta);
    });

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
    /**
     * O que falta fazer primeiro fica dito, com nomes, no idioma certo.
     *
     * Este teste afirmava que a frase da API aparecia tal e qual — e é
     * assim que uma pessoa a ler inglês apanhava português. Mas a razão
     * original era boa: sem o nome da crew, a pessoa fica à procura.
     *
     * Por isso os nomes passaram a vir **à parte** do texto, e a frase é
     * composta aqui. A suite corre em inglês: o nome tem de aparecer, e
     * o português da API não.
     */
    it('diz que comunidades ficam sem dono, no idioma de quem lê', async () => {
        vi.stubGlobal(
            'fetch',
            servidor(
                json(409, {
                    code: 'ACCOUNT_LEADS_COMMUNITIES',
                    message:
                        'És a única pessoa que manda em: Vice Kings. Passa o cargo a outra pessoa.',
                    communities: ['Vice Kings', 'Little Havana'],
                }),
            ),
        );

        montarEcra(<ApagarConta username="player" />);

        await userEvent.type(
            screen.getByLabelText(t.zonaPerigo.confirmacao),
            'player',
        );
        await userEvent.click(screen.getByText(t.perfil.apagarContaConfirmar));

        const aviso = await screen.findByText(/Vice Kings/);

        /* Os dois nomes, e não só o primeiro. */
        expect(aviso.textContent).toContain('Little Havana');

        /* E a frase é a nossa, no idioma de quem lê. */
        expect(aviso.textContent).toBe(
            t.zonaPerigo.aindaMandasEm('Vice Kings, Little Havana'),
        );
        expect(aviso.textContent).not.toContain('És a única pessoa');

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

    /**
     * O saldo perde-se ao apagar a conta, e por isso tem de ser dito
     * antes.
     *
     * Antes disto o saldo **impedia** apagar, com uma mensagem a mandar
     * transferi-lo ou gastá-lo — e não há rota nenhuma por onde uma
     * pessoa tire dinheiro da sua carteira. Trocar uma porta trancada
     * por dinheiro a desaparecer sem aviso não era uma melhoria; o
     * aviso é que é.
     */
    describe('o saldo que se vai perder', () => {
        /**
         * Abaixo de mil de propósito: assim o número aparece tal e qual
         * e a asserção não passa a depender do separador de milhares,
         * que é assunto de outro teste.
         */
        it('diz quanto é, antes de se apagar seja o que for', async () => {
            vi.stubGlobal('fetch', servidor(json(204, null), '900'));

            montarEcra(<ApagarConta username="player" />);

            expect(
                await screen.findByText(t.perfil.apagarContaPerdeSaldo('900')),
            ).toBeDefined();
        });

        /**
         * A quem tem a carteira vazia, dizer-lhe que o saldo se perde
         * era assustar por nada.
         */
        it('não avisa quem não tem nada a perder', async () => {
            vi.stubGlobal('fetch', servidor(json(204, null), '0'));

            montarEcra(<ApagarConta username="player" />);

            await waitFor(() => {
                expect(
                    screen.getByText(t.perfil.apagarContaConfirmar),
                ).toBeDefined();
            });

            expect(
                screen.queryByText(t.perfil.apagarContaPerdeSaldo('0')),
            ).toBeNull();
        });

        /**
         * E uma falha a ler o saldo não pode ser o que impede alguém de
         * sair. Sem aviso, mas com a porta aberta — e nunca um número
         * inventado.
         */
        it('deixa apagar na mesma quando não consegue ler o saldo', async () => {
            const fetchMock = vi.fn((url: string) =>
                String(url).endsWith('/treasury/me')
                    ? Promise.resolve(json(500, { code: 'INTERNAL' }))
                    : Promise.resolve(json(204, null)),
            );

            vi.stubGlobal('fetch', fetchMock);

            montarEcra(<ApagarConta username="player" />);

            await userEvent.type(
                screen.getByLabelText(t.zonaPerigo.confirmacao),
                'player',
            );

            await userEvent.click(
                screen.getByText(t.perfil.apagarContaConfirmar),
            );

            await waitFor(() => {
                expect(
                    fetchMock.mock.calls.some((argumentos) =>
                        String(argumentos[0]).endsWith('/users/me'),
                    ),
                ).toBe(true);
            });
        });
    });
});
