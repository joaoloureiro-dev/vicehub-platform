import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router';

import userEvent from '@testing-library/user-event';

import { TreasuryPage } from '../src/treasury/pages/treasury.page.js';
import { montarEcra, t } from './helpers.js';

/** Um evento como a API o devolve, com o que este ecrã lê dele. */
const evento = (extra: Record<string, unknown> = {}) => ({
    id: 'ev-1',
    name: 'Assalto ao banco',
    description: null,
    status: 'completed',
    startsAt: '2026-02-01T21:00:00.000Z',
    endsAt: null,
    capacity: null,
    isPublic: false,
    organizerId: 'u1',
    signedUpCount: 6,
    confirmedCount: 4,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...extra,
});

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
const servir = (opcoes: {
    premium: boolean;
    movimentos?: unknown[];
    /** O plano da crew, como a rota de quem a gere o devolve. */
    plano?: { isTrial: boolean; activeUntil: string | null } | 403;
    /** Os eventos da crew, para a divisão por participação. */
    eventos?: unknown[];
    /** As divisões já existentes, como a API as devolve. */
    divisoes?: unknown[];
}) =>
    /*
     * Dois argumentos, como o `fetch` a sério: os casos da divisão leem
     * o corpo do pedido para provar que campo foi enviado em que base.
     */
    vi.fn((url: string, _init?: RequestInit) => {
        const endereco = String(url);

        /**
         * Antes da tesouraria, porque `/subscriptions/crews/:id` também
         * contém `/crews/`. Um ramo genérico respondia-lhe com o perfil
         * da crew, e o ecrã lia `isTrial` de onde ele não existe — sem
         * erro nenhum, e com os testes a passar.
         */
        if (endereco.includes('/subscriptions/crews/')) {
            if (opcoes.plano === 403) {
                return Promise.resolve(json(403, { code: 'FORBIDDEN' }));
            }

            return Promise.resolve(
                json(200, {
                    isPremium: opcoes.premium,
                    isLifetime: false,
                    isTrial: opcoes.plano?.isTrial ?? false,
                    activeUntil: opcoes.plano?.activeUntil ?? null,
                    via: null,
                    history: [],
                }),
            );
        }

        if (endereco.includes('/distributions')) {
            return Promise.resolve(json(200, opcoes.divisoes ?? []));
        }

        /*
         * Antes de `/crews/`, pela mesma razão que as subscrições: a
         * rota dos eventos é `/events/crews/:id` e cairia no ramo do
         * perfil da crew.
         */
        if (endereco.includes('/events/crews/')) {
            return Promise.resolve(json(200, opcoes.eventos ?? []));
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

/**
 * A avaliação acaba. Acabar em silêncio — com a tesouraria a fechar-se
 * sem aviso a quem estava a usá-la todos os dias — era a pior maneira
 * de vender.
 */
describe('a avaliação de uma crew nova', () => {
    /** Daqui a N dias, em ISO. */
    const daqui = (dias: number) =>
        new Date(Date.now() + dias * 86_400_000).toISOString();

    it('diz quantos dias faltam', async () => {
        vi.stubGlobal(
            'fetch',
            servir({
                premium: true,
                plano: { isTrial: true, activeUntil: daqui(12) },
            }),
        );

        montar();

        expect(
            await screen.findByText(
                t.tesouraria.avaliacaoAcaba(12),
                { exact: false },
            ),
        ).toBeDefined();
    });

    /**
     * Com dezoito horas por passar, o que falta é um dia e não zero —
     * "zero dias" num ecrã que ainda funciona lê-se como avaria.
     */
    it('arredonda para cima o último dia', async () => {
        vi.stubGlobal(
            'fetch',
            servir({
                premium: true,
                plano: { isTrial: true, activeUntil: daqui(0.75) },
            }),
        );

        montar();

        expect(
            await screen.findByText(t.tesouraria.avaliacaoAcaba(1), {
                exact: false,
            }),
        ).toBeDefined();
    });

    it('num plano pago, não fala de avaliação nenhuma', async () => {
        vi.stubGlobal(
            'fetch',
            servir({
                premium: true,
                plano: { isTrial: false, activeUntil: daqui(12) },
            }),
        );

        montar();

        await waitFor(() => {
            expect(screen.getByLabelText(t.tesouraria.montante)).toBeDefined();
        });

        expect(
            screen.queryByText(t.tesouraria.avaliacaoAcaba(12), {
                exact: false,
            }),
        ).toBeNull();
    });

    /**
     * Quem pertence à crew mas não a gere leva 403 nesta pergunta, e
     * isso não é avaria: continua a ver a tesouraria na mesma, sem o
     * aviso que não lhe diz respeito.
     */
    it('a quem não gere a crew, não mostra nada disto', async () => {
        vi.stubGlobal(
            'fetch',
            servir({ premium: true, plano: 403 }),
        );

        montar();

        await waitFor(() => {
            expect(screen.getByLabelText(t.tesouraria.montante)).toBeDefined();
        });

        expect(screen.queryByText(/trial/i)).toBeNull();
    });
});

/**
 * Quantas pessoas uma divisão paga.
 *
 * As linhas de uma divisão são partida dobrada: uma a débito, com a
 * tesouraria a pagar o total, e uma a crédito por cada pessoa que
 * recebe. Contá-las todas dizia que uma divisão de duas pessoas pagou a
 * três — e o comentário no tipo dizia "uma linha por pessoa", que era a
 * afirmação falsa por onde o erro entrou.
 */
describe('quantas pessoas uma divisão paga', () => {
    const divisaoDeDuas = {
        id: 'div-1',
        total: '900',
        basis: 'participation',
        status: 'pending',
        eventId: 'ev-1',
        note: null,
        requestedBy: 'u1',
        decidedBy: null,
        decidedAt: null,
        createdAt: '2026-02-02T00:00:00.000Z',
        lines: [
            {
                id: 'l-0',
                amount: '900',
                direction: 'debit',
                category: 'payout',
                status: 'pending',
                description: 'Divisão de ganhos pelos membros',
                requestedBy: 'u1',
                decidedBy: null,
                decidedAt: null,
                createdAt: '2026-02-02T00:00:00.000Z',
            },
            ...['l-1', 'l-2'].map((id) => ({
                id,
                amount: '450',
                direction: 'credit',
                category: 'payout',
                status: 'pending',
                description: 'Parte da divisão de ganhos',
                requestedBy: 'u1',
                decidedBy: null,
                decidedAt: null,
                createdAt: '2026-02-02T00:00:00.000Z',
            })),
        ],
    };

    it('conta quem recebe, e não a saída da tesouraria', async () => {
        vi.stubGlobal(
            'fetch',
            servir({ premium: true, divisoes: [divisaoDeDuas] }),
        );

        montar();

        expect(await screen.findByText(t.tesouraria.pessoas(2))).toBeDefined();
        expect(screen.queryByText(t.tesouraria.pessoas(3))).toBeNull();
    });
});

/**
 * Dividir o que a crew ganhou.
 *
 * O ecrã não existia. A API dividia por partes iguais, por cargo e por
 * quem apareceu; o cliente já sabia pedir as três; o dicionário já
 * tinha nome para elas. Faltava quem as chamasse — e a página de um
 * evento dizia a quem confirmasse presenças que a crew já podia
 * dividir a partir dali, o que era uma promessa que o produto não
 * cumpria.
 */
describe('dividir o que a crew ganhou', () => {
    it('não aparece sem plano, como o resto do que mexe no dinheiro', async () => {
        vi.stubGlobal('fetch', servir({ premium: false }));

        montar();

        await waitFor(() => {
            expect(screen.getByText(t.tesouraria.titulo)).toBeDefined();
        });

        expect(screen.queryByText(t.tesouraria.dividirTitulo)).toBeNull();
    });

    it('oferece as bases que a API sabe dividir', async () => {
        vi.stubGlobal('fetch', servir({ premium: true }));

        montar();

        expect(
            await screen.findByLabelText(t.tesouraria.comoDividir),
        ).toBeDefined();
        expect(screen.getByText(t.bases.equal)).toBeDefined();
        expect(screen.getByText(t.bases.by_role)).toBeDefined();
        expect(screen.getByText(t.bases.participation)).toBeDefined();
    });

    /**
     * O evento só se pergunta quando a base o usa: a esmagadora maioria
     * das divisões não é por participação, e pedir a lista ao abrir a
     * tesouraria era uma ida à API que quase nunca servia.
     */
    it('só pergunta pelos eventos quando a base é por participação', async () => {
        const fetchMock = servir({ premium: true, eventos: [evento()] });

        vi.stubGlobal('fetch', fetchMock);

        montar();

        const base = await screen.findByLabelText(t.tesouraria.comoDividir);

        const pedidosAEventos = () =>
            fetchMock.mock.calls.filter((argumentos) =>
                String(argumentos[0]).includes('/events/crews/'),
            ).length;

        expect(pedidosAEventos()).toBe(0);

        /* Outra base não pergunta nada. */
        await userEvent.selectOptions(base, 'by_role');
        expect(pedidosAEventos()).toBe(0);

        await userEvent.selectOptions(base, 'participation');

        await waitFor(() => {
            expect(pedidosAEventos()).toBe(1);
        });

        /*
         * E volta a escolhê-la sem voltar a perguntar: a lista já cá
         * está, e pedi-la a cada troca de base castigava quem hesita.
         */
        await userEvent.selectOptions(base, 'equal');
        await userEvent.selectOptions(base, 'participation');

        await screen.findByLabelText(t.tesouraria.deQueEvento);

        expect(pedidosAEventos()).toBe(1);
    });

    it('mostra quantos apareceram em cada evento', async () => {
        vi.stubGlobal(
            'fetch',
            servir({ premium: true, eventos: [evento({ confirmedCount: 4 })] }),
        );

        montar();

        await userEvent.selectOptions(
            await screen.findByLabelText(t.tesouraria.comoDividir),
            'participation',
        );

        expect(
            await screen.findByText(
                `Assalto ao banco — ${t.tesouraria.presencas(4)}`,
            ),
        ).toBeDefined();
    });

    /**
     * Um evento sem presenças confirmadas **só pode falhar**: a API
     * recusa-o com NO_CONFIRMED_PARTICIPANTS porque não há por onde
     * dividir. Oferecê-lo era oferecer uma escolha impossível, que é
     * diferente de oferecer e deixar a API recusar.
     */
    it('não oferece um evento onde ninguém apareceu', async () => {
        vi.stubGlobal(
            'fetch',
            servir({ premium: true, eventos: [evento({ confirmedCount: 0 })] }),
        );

        montar();

        await userEvent.selectOptions(
            await screen.findByLabelText(t.tesouraria.comoDividir),
            'participation',
        );

        expect(
            await screen.findByText(t.tesouraria.semEventosComPresencas),
        ).toBeDefined();
        expect(screen.queryByText(/Assalto ao banco/)).toBeNull();
    });

    it('e diz o que fazer para o destrancar, quando não há nenhum', async () => {
        vi.stubGlobal('fetch', servir({ premium: true, eventos: [] }));

        montar();

        await userEvent.selectOptions(
            await screen.findByLabelText(t.tesouraria.comoDividir),
            'participation',
        );

        expect(
            await screen.findByText(t.tesouraria.semEventosComPresencas),
        ).toBeDefined();
    });

    /**
     * Sem evento escolhido o pedido não sai. A API recusava-o na mesma,
     * mas com um erro que se lê como avaria em vez de "falta escolher".
     */
    it('não deixa propor por participação sem escolher o evento', async () => {
        vi.stubGlobal('fetch', servir({ premium: true, eventos: [evento()] }));

        montar();

        await userEvent.type(
            await screen.findByLabelText(t.tesouraria.totalADividir),
            '900',
        );
        await userEvent.selectOptions(
            screen.getByLabelText(t.tesouraria.comoDividir),
            'participation',
        );

        await screen.findByLabelText(t.tesouraria.deQueEvento);

        expect(
            screen.getByRole('button', { name: t.tesouraria.dividir }),
        ).toHaveProperty('disabled', true);
    });

    it('propõe a divisão com o evento escolhido', async () => {
        const fetchMock = servir({ premium: true, eventos: [evento()] });

        vi.stubGlobal('fetch', fetchMock);

        montar();

        await userEvent.type(
            await screen.findByLabelText(t.tesouraria.totalADividir),
            '900',
        );
        await userEvent.selectOptions(
            screen.getByLabelText(t.tesouraria.comoDividir),
            'participation',
        );
        await userEvent.selectOptions(
            await screen.findByLabelText(t.tesouraria.deQueEvento),
            'ev-1',
        );
        await userEvent.click(
            screen.getByRole('button', { name: t.tesouraria.dividir }),
        );

        await waitFor(() => {
            expect(screen.getByText(t.tesouraria.divisaoProposta)).toBeDefined();
        });

        const pedido = fetchMock.mock.calls.find(
            (argumentos) =>
                String(argumentos[0]).includes('/distributions')
                && (argumentos[1] as { method?: string } | undefined)?.method
                    === 'POST',
        );

        expect(
            JSON.parse(
                String((pedido?.[1] as { body?: string } | undefined)?.body),
            ),
        ).toEqual({ basis: 'participation', total: '900', eventId: 'ev-1' });
    });

    /**
     * Propor e não ver nada mudar é indistinguível de não ter proposto.
     * A divisão nova fica pendente, e é na lista que ela aparece.
     */
    it('recarrega a tesouraria depois de propor', async () => {
        const fetchMock = servir({ premium: true, eventos: [evento()] });

        vi.stubGlobal('fetch', fetchMock);

        montar();

        const leituras = () =>
            fetchMock.mock.calls.filter(
                (argumentos) =>
                    String(argumentos[0]).includes('/distributions')
                    && (argumentos[1] as { method?: string } | undefined)
                        ?.method !== 'POST',
            ).length;

        await userEvent.type(
            await screen.findByLabelText(t.tesouraria.totalADividir),
            '400',
        );

        const antes = leituras();

        await userEvent.click(
            screen.getByRole('button', { name: t.tesouraria.dividir }),
        );

        await waitFor(() => {
            expect(leituras()).toBeGreaterThan(antes);
        });
    });

    /**
     * O evento **não** vai nas bases que o ignoram: a API recusa-o, e
     * mandá-lo à mesma dava um 400 que se lê como avaria em vez de
     * "esse campo não é desta base".
     */
    it('não manda evento nenhum numa divisão por partes iguais', async () => {
        const fetchMock = servir({ premium: true, eventos: [evento()] });

        vi.stubGlobal('fetch', fetchMock);

        montar();

        await userEvent.type(
            await screen.findByLabelText(t.tesouraria.totalADividir),
            '400',
        );

        /*
         * Escolher o evento e **mudar de ideias**, que é o único caminho
         * onde isto se prova.
         *
         * Submeter sem nunca lá ter ido deixava o campo vazio, e um
         * campo vazio não é enviado de qualquer maneira: o caso passava
         * sem provar nada. Foi assim que este teste nasceu, e foi a
         * mutação que o apanhou.
         */
        const base = screen.getByLabelText(t.tesouraria.comoDividir);

        await userEvent.selectOptions(base, 'participation');
        await userEvent.selectOptions(
            await screen.findByLabelText(t.tesouraria.deQueEvento),
            'ev-1',
        );
        await userEvent.selectOptions(base, 'equal');

        await userEvent.click(
            screen.getByRole('button', { name: t.tesouraria.dividir }),
        );

        await waitFor(() => {
            expect(screen.getByText(t.tesouraria.divisaoProposta)).toBeDefined();
        });

        const pedido = fetchMock.mock.calls.find(
            (argumentos) =>
                String(argumentos[0]).includes('/distributions')
                && (argumentos[1] as { method?: string } | undefined)?.method
                    === 'POST',
        );

        expect(
            JSON.parse(
                String((pedido?.[1] as { body?: string } | undefined)?.body),
            ),
        ).toEqual({ basis: 'equal', total: '400' });
    });
});
