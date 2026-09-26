import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { AuthProvider } from '../src/auth/auth.context.js';
import { PendingProvider, usePendente } from '../src/pages/pending.context.js';
import { irEVoltar, montarEcra } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const PENDENTE = {
    items: [],
    friendRequests: 2,
    answers: 1,
    answersSeenAt: null,
    total: 3,
};

/** O que a API responde, e que pode mudar a meio de um teste. */
const estado = { total: PENDENTE.total };

const servir = (comSessao = true) =>
    vi.fn((url: string) => {
        const endereco = String(url);

        if (endereco.endsWith('/auth/refresh')) {
            return Promise.resolve(
                comSessao
                    ? json(200, {
                        accessToken: 'token',
                        user: {
                            id: 'u1',
                            email: 'jogador@vicehub.test',
                            username: 'jogador',
                        },
                    })
                    : json(401, { code: 'INVALID_REFRESH_TOKEN' }),
            );
        }

        if (endereco.includes('/users/me/pending')) {
            return Promise.resolve(
                json(200, { ...PENDENTE, total: estado.total }),
            );
        }

        throw new Error(`pedido inesperado a ${endereco}`);
    });

/** Dois consumidores, como na aplicação: a navegação e a secção. */
const Consumidor = ({ etiqueta }: { etiqueta: string }) => {
    const { pendente } = usePendente();

    return <span>{`${etiqueta}:${pendente?.total ?? '-'}`}</span>;
};

const montar = (comSessao = true) => {
    const fetchMock = servir(comSessao);

    vi.stubGlobal('fetch', fetchMock);

    montarEcra(
        <AuthProvider>
            <PendingProvider>
                <Consumidor etiqueta="nav" />
                <Consumidor etiqueta="seccao" />
            </PendingProvider>
        </AuthProvider>,
    );

    return fetchMock;
};

const pedidosAoPendente = (fetchMock: ReturnType<typeof vi.fn>): number =>
    fetchMock.mock.calls.filter((argumentos) =>
        String(argumentos[0]).includes('/users/me/pending'),
    ).length;

afterEach(() => {
    estado.total = PENDENTE.total;
    vi.unstubAllGlobals();
});

/**
 * Uma origem só para o que está à espera.
 *
 * Nasceu de uma coisa medida: abrir `/eu/comunidades` pedia
 * `/users/me/pending` **três vezes**. A navegação pedia-o para o número
 * ao lado de "as minhas", a secção do topo pedia-o outra vez para a
 * lista, e nenhuma das duas sabia da outra.
 *
 * E é isso que torna o número honesto: sem origem comum, nada podia
 * dizer à navegação que ele já não estava certo depois de a pessoa ver
 * as respostas.
 */
describe('o pendente partilhado', () => {
    it('pergunta uma vez, por muitos que sejam a ler', async () => {
        const fetchMock = montar();

        await waitFor(() => {
            expect(screen.getByText('nav:3')).toBeTruthy();
        });

        expect(screen.getByText('seccao:3')).toBeTruthy();
        expect(pedidosAoPendente(fetchMock)).toBe(1);
    });

    /**
     * E acompanha quem não recarrega a página.
     *
     * Numa aplicação de uma página só, quem entra de manhã e navega a
     * tarde inteira nunca mais via um número novo. Uma candidatura
     * respondida enquanto a pessoa navega é uma resposta que ela
     * merece ver sem carregar em F5 — o mesmo relógio da caixa de
     * avisos, e pela mesma razão.
     */
    it('acerta sozinho quando a pessoa volta ao separador', async () => {
        montar();

        await waitFor(() => {
            expect(screen.getByText('nav:3')).toBeTruthy();
        });

        estado.total = 7;

        irEVoltar();

        await waitFor(() => {
            expect(screen.getByText('nav:7')).toBeTruthy();
        });
    });

    /**
     * Sem sessão não há nada a contar, e perguntar dava 401 a quem só
     * está a ver o diretório de crews.
     */
    it('não pergunta nada a quem não tem sessão', async () => {
        const fetchMock = montar(false);

        await waitFor(() => {
            expect(screen.getByText('nav:-')).toBeTruthy();
        });

        expect(pedidosAoPendente(fetchMock)).toBe(0);
    });
});
