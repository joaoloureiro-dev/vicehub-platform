import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router';

import { TreasuryPage } from '../src/treasury/pages/treasury.page.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const crew = (isPremium: boolean) => ({
    id: 'crew-1',
    name: 'Vice Kings',
    tag: 'VICE',
    description: null,
    joinRequirements: null,
    isRecruiting: false,
    recruitingSince: null,
    level: 3,
    xp: '250',
    levelXp: '100',
    nextLevelXp: '300',
    rank: null,
    influence: 0,
    prestige: 0,
    isPremium,
    premiumVia: null,
    appearance: { bannerUrl: null, accentColor: null },
    memberCount: 4,
    createdAt: '2026-01-01T00:00:00.000Z',
});

const pendente = {
    id: 'mov-1',
    amount: '500',
    direction: 'credit',
    category: 'contribution',
    status: 'pending',
    description: 'Ganhos da noite',
    requestedBy: 'u1',
    decidedBy: null,
    decidedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
};

/**
 * Cada rota é nomeada. Um ramo genérico a servir "o resto" já escondeu
 * bugs neste repositório mais do que uma vez: o ecrã recebia a forma
 * errada, não mostrava nada, e os testes passavam à mesma.
 */
const servir = (opcoes: { premium: boolean; movimentos?: unknown[] }) =>
    vi.fn((url: string) => {
        const endereco = String(url);

        if (endereco.includes('/distributions')) {
            return Promise.resolve(json(200, []));
        }

        if (endereco.includes('/treasury/crews/')) {
            return Promise.resolve(
                json(200, {
                    balances: {
                        settled: '1000',
                        pendingIn: '500',
                        pendingOut: '0',
                        available: '1000',
                    },
                    movements: opcoes.movimentos ?? [pendente],
                }),
            );
        }

        if (endereco.includes('/crews/')) {
            return Promise.resolve(json(200, crew(opcoes.premium)));
        }

        throw new Error(`rota não prevista pelo duplo: ${endereco}`);
    });

const montar = () =>
    montarEcra(
        <Routes>
            <Route path="/crews/:crewId/tesouraria" element={<TreasuryPage />} />
        </Routes>,
        '/crews/crew-1/tesouraria',
    );

afterEach(() => {
    vi.unstubAllGlobals();
});

/**
 * O que a plataforma dá e o que vende, no ecrã.
 *
 * **Ler a tesouraria é de graça; mexer no dinheiro é que é o plano.** As
 * duas metades têm de estar aqui: um paywall que fechasse a leitura
 * escondia a uma crew o dinheiro que é dela, e um que deixasse os botões
 * à vista fazia toda a gente descobrir a regra por um erro.
 */
describe('a tesouraria de uma crew sem plano', () => {
    it('continua a mostrar o saldo', async () => {
        vi.stubGlobal('fetch', servir({ premium: false }));

        montar();

        expect(await screen.findByText(t.tesouraria.disponivel)).toBeDefined();
    });

    it('continua a mostrar o extrato', async () => {
        vi.stubGlobal('fetch', servir({ premium: false }));

        montar();

        expect(await screen.findByText('Ganhos da noite')).toBeDefined();
    });

    it('explica porque não dá para propor, e diz onde resolver', async () => {
        vi.stubGlobal('fetch', servir({ premium: false }));

        montar();

        expect(
            await screen.findByText(t.tesouraria.precisaDePlano),
        ).toBeDefined();

        expect(
            screen.getByText(t.tesouraria.verPlano).getAttribute('href'),
        ).toBe('/premium?crew=crew-1');
    });

    it('não mostra o formulário de propor', async () => {
        vi.stubGlobal('fetch', servir({ premium: false }));

        montar();

        await waitFor(() => {
            expect(screen.getByText(t.tesouraria.precisaDePlano)).toBeDefined();
        });

        expect(screen.queryByLabelText(t.tesouraria.montante)).toBeNull();
    });

    /**
     * Todos estes botões respondem 402. Um botão que só pode recusar é
     * pior do que botão nenhum — e o movimento fica à vista, pendente, à
     * espera de que o plano volte.
     */
    it('não oferece decidir o que ficou pendente', async () => {
        vi.stubGlobal('fetch', servir({ premium: false }));

        montar();

        await waitFor(() => {
            expect(screen.getByText('Ganhos da noite')).toBeDefined();
        });

        expect(
            screen.queryByRole('button', { name: t.tesouraria.aprovar }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: t.tesouraria.recusar }),
        ).toBeNull();
    });
});

describe('a tesouraria de uma crew com plano', () => {
    it('mostra o formulário de propor', async () => {
        vi.stubGlobal('fetch', servir({ premium: true }));

        montar();

        expect(
            await screen.findByLabelText(t.tesouraria.montante),
        ).toBeDefined();
    });

    it('não avisa de plano nenhum', async () => {
        vi.stubGlobal('fetch', servir({ premium: true }));

        montar();

        await waitFor(() => {
            expect(screen.getByLabelText(t.tesouraria.montante)).toBeDefined();
        });

        expect(screen.queryByText(t.tesouraria.precisaDePlano)).toBeNull();
    });

    it('oferece decidir o que está pendente', async () => {
        vi.stubGlobal('fetch', servir({ premium: true }));

        montar();

        expect(
            await screen.findByRole('button', { name: t.tesouraria.aprovar }),
        ).toBeDefined();
    });
});
