import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { AuthProvider } from '../src/auth/auth.context.js';
import { Pendentes } from '../src/pages/pendentes.js';
import { PendingProvider } from '../src/pages/pending.context.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const servir = (corpo: unknown) =>
    vi.fn((url: string) => {
        const endereco = String(url);

        /*
         * O pendente agora vem de um contexto, e o contexto só pergunta
         * havendo sessão — por isso o duplo tem de saber responder à
         * troca do cookie por um token, como a aplicação a faz.
         */
        if (endereco.endsWith('/auth/refresh')) {
            return Promise.resolve(
                json(200, {
                    accessToken: 'token',
                    user: {
                        id: 'u1',
                        email: 'jogador@vicehub.test',
                        username: 'jogador',
                    },
                }),
            );
        }

        if (endereco.includes('/users/me/pending')) {
            return Promise.resolve(json(200, corpo));
        }

        throw new Error(`pedido inesperado a ${endereco}`);
    });

/** Como a aplicação o monta: com sessão, e com o pendente partilhado. */
const montar = () =>
    montarEcra(
        <AuthProvider>
            <PendingProvider>
                <Pendentes />
            </PendingProvider>
        </AuthProvider>,
    );

const VAZIO = {
    items: [],
    friendRequests: 0,
    answers: 0,
    answersSeenAt: null,
    total: 0,
};

afterEach(() => {
    vi.unstubAllGlobals();
});

/**
 * O que precisa de mim.
 *
 * Duas coisas a guardar: **leva a quem clica ao sítio onde a coisa se
 * resolve** — não a uma listagem intermédia, porque quem clica quer
 * decidir e não procurar — e **desaparece quando não há nada**, porque
 * uma secção a dizer "não tens nada" é uma linha que se lê todos os
 * dias para não dizer nada.
 */
describe('o que precisa de mim', () => {
    it('não aparece de todo quando não há nada à espera', async () => {
        vi.stubGlobal('fetch', servir(VAZIO));

        montar();

        await waitFor(() => {
            expect(screen.queryByText(t.pendentes.titulo)).toBeNull();
        });
    });

    it('diz onde é e quantos são', async () => {
        vi.stubGlobal(
            'fetch',
            servir({
                items: [
                    {
                        kind: 'crew_join_request',
                        communityKind: 'crew',
                        communityId: 'c1',
                        communityName: 'Vice Kings',
                        count: 3,
                    },
                ],
                friendRequests: 0,
                total: 3,
            }),
        );

        montar();

        expect(await screen.findByText('Vice Kings')).toBeTruthy();
        expect(screen.getByText(t.pendentes.pedidosDeEntrada(3))).toBeTruthy();
    });

    /**
     * Cada espécie de espera leva ao sítio onde se resolve. O dinheiro
     * é o caso que mais importa acertar: a tesouraria tem página
     * própria, e mandar quem vai decidir para o perfil da crew era
     * deixá-lo a mais um clique de distância.
     */
    it.each([
        ['crew_join_request', 'crew', '/crews/c1'],
        ['server_join_request', 'server', '/servidores/s1'],
        ['affiliation_request', 'server', '/servidores/s1'],
        ['treasury_decision', 'crew', '/crews/c1/tesouraria'],
    ])('%s leva a %s', async (kind, communityKind, destino) => {
        vi.stubGlobal(
            'fetch',
            servir({
                items: [
                    {
                        kind,
                        communityKind,
                        communityId: communityKind === 'crew' ? 'c1' : 's1',
                        communityName: 'Onde',
                        count: 1,
                    },
                ],
                friendRequests: 0,
                total: 1,
            }),
        );

        montar();

        const ligacao = await screen.findByText('Onde');

        expect(ligacao.closest('a')?.getAttribute('href')).toBe(destino);
    });

    it('conta também os pedidos de amizade', async () => {
        vi.stubGlobal(
            'fetch',
            servir({ items: [], friendRequests: 2, total: 2 }),
        );

        montar();

        expect(
            await screen.findByText(t.pendentes.pedidosDeAmizade(2)),
        ).toBeTruthy();
    });

    /**
     * Uma resposta que chegue meia — a rota a falhar, um duplo a
     * responder outra coisa — não pode levar a página atrás. Sem nada
     * para mostrar, não mostra nada.
     */
    it('não rebenta com uma resposta sem a forma esperada', async () => {
        vi.stubGlobal('fetch', servir({}));

        montar();

        await waitFor(() => {
            expect(screen.queryByText(t.pendentes.titulo)).toBeNull();
        });
    });

    it('não rebenta quando o pedido falha', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn((_url: string) => Promise.reject(new Error('sem rede'))),
        );

        montar();

        await waitFor(() => {
            expect(screen.queryByText(t.pendentes.titulo)).toBeNull();
        });
    });
});
