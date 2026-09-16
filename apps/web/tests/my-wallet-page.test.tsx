import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { MyWalletPage } from '../src/treasury/pages/my-wallet.page.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

/**
 * A carteira de quem está a ver.
 *
 * Existia na API desde sempre e não tinha ecrã. Quem recebia a sua parte
 * de uma divisão não via o dinheiro chegar a lado nenhum — e ao tentar
 * apagar a conta era recusado com "a tua carteira ainda tem saldo", sem
 * forma de saber quanto era nem de onde tinha vindo.
 */
describe('a minha carteira', () => {
    const parte = {
        id: 'mov-1',
        amount: '450',
        direction: 'credit',
        category: 'payout',
        status: 'approved',
        description: 'Parte da divisão de ganhos',
        requestedBy: 'u1',
        decidedBy: 'u1',
        decidedAt: '2026-02-02T00:00:00.000Z',
        createdAt: '2026-02-02T00:00:00.000Z',
    };

    const servir = (movimentos: unknown[]) =>
        vi.fn((url: string) => {
            const endereco = String(url);

            if (endereco.endsWith('/treasury/me')) {
                return Promise.resolve(
                    json(200, {
                        /**
                         * Quatro números diferentes, de propósito. Com
                         * dois iguais, trocar um saldo pelo outro no
                         * ecrã não se via — o teste encontrava o número
                         * na mesma, vindo do sítio errado.
                         */
                        balances: {
                            settled: '450',
                            pendingIn: '120',
                            pendingOut: '30',
                            available: '420',
                        },
                        movements: movimentos,
                    }),
                );
            }

            throw new Error(`rota não prevista pelo duplo: ${endereco}`);
        });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    /** O valor que está debaixo de um rótulo, e não em qualquer sítio. */
    const saldoDe = (rotulo: string): string | undefined =>
        screen.getByText(rotulo).parentElement?.querySelector('dd')
            ?.textContent ?? undefined;

    it('mostra cada saldo debaixo do seu nome', async () => {
        vi.stubGlobal('fetch', servir([parte]));

        montarEcra(<MyWalletPage />, '/eu/carteira');

        expect(await screen.findByText(t.carteira.titulo)).toBeDefined();

        expect(saldoDe(t.tesouraria.disponivel)).toBe('420');
        expect(saldoDe(t.tesouraria.liquidado)).toBe('450');
        expect(saldoDe(t.tesouraria.aEntrar)).toBe('120');
        expect(saldoDe(t.tesouraria.aSair)).toBe('30');
    });

    /**
     * De onde veio o dinheiro é metade do que a pessoa quer saber. Um
     * saldo sozinho não explica nada.
     */
    it('mostra de onde veio cada entrada', async () => {
        vi.stubGlobal('fetch', servir([parte]));

        montarEcra(<MyWalletPage />, '/eu/carteira');

        expect(
            await screen.findByText('Parte da divisão de ganhos'),
        ).toBeDefined();
    });

    /**
     * Uma carteira vazia é o caso normal de quem acabou de chegar, e
     * dizê-lo é melhor do que uma lista em branco que se lê como avaria.
     */
    it('diz que ainda não chegou nada quando não chegou', async () => {
        vi.stubGlobal('fetch', servir([]));

        montarEcra(<MyWalletPage />, '/eu/carteira');

        expect(await screen.findByText(t.carteira.aindaSemNada)).toBeDefined();
    });

    /**
     * Não há rota nenhuma por onde uma pessoa mova dinheiro da sua
     * carteira, e por isso este ecrã não oferece nenhum botão que o
     * finja. Se um dia houver, este teste é o que há de mudar — de
     * propósito.
     */
    it('não oferece mexer no dinheiro, porque a API não o serve', async () => {
        vi.stubGlobal('fetch', servir([parte]));

        montarEcra(<MyWalletPage />, '/eu/carteira');

        await screen.findByText(t.carteira.titulo);

        expect(screen.queryAllByRole('button')).toHaveLength(0);
    });
});
