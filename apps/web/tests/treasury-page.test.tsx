import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
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
const servidor = (isPremium: boolean) => ({
    id: 'srv-1',
    name: 'Leonida Life',
    region: 'EU',
    description: null,
    joinRequirements: null,
    isOnline: true,
    playersOnline: 12,
    isPremium,
    appearance: { bannerUrl: null, accentColor: null },
    memberCount: 9,
    createdAt: '2026-01-01T00:00:00.000Z',
});

const servir = (opcoes: {
    premium: boolean;
    movimentos?: unknown[];
    /** O plano da crew, como a rota de quem a gere o devolve. */
    plano?: { isTrial: boolean; activeUntil: string | null } | 403;
    /** Os eventos da crew, para a divisão por participação. */
    eventos?: unknown[];
    /** As divisões já existentes, como a API as devolve. */
    divisoes?: unknown[];
    /** As crews que jogam no servidor, para as transferências. */
    afiliacoes?: unknown[];
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
        if (endereco.includes('/subscriptions/servers/')) {
            return Promise.resolve(
                json(200, {
                    isPremium: opcoes.premium,
                    isLifetime: false,
                    isTrial: false,
                    activeUntil: null,
                    via: null,
                    history: [],
                }),
            );
        }

        if (endereco.includes('/affiliations')) {
            return Promise.resolve(json(200, opcoes.afiliacoes ?? []));
        }

        /*
         * Antes de `/servers/`, porque a tesouraria de um servidor é
         * `/treasury/servers/:id` e cairia no ramo do perfil.
         */
        if (endereco.includes('/treasury/servers/')) {
            return Promise.resolve(
                json(200, {
                    balances: {
                        settled: '1000',
                        pendingIn: '0',
                        pendingOut: '0',
                        available: '1000',
                    },
                    movements: opcoes.movimentos ?? [],
                }),
            );
        }

        if (endereco.includes('/servers/')) {
            return Promise.resolve(json(200, servidor(opcoes.premium)));
        }

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

/** As duas rotas, como a aplicação as monta. */
const AS_ROTAS = (
    <Routes>
        <Route path="/crews/:crewId/tesouraria" element={<TreasuryPage />} />
        <Route
            path="/servidores/:serverId/tesouraria"
            element={<TreasuryPage />}
        />
    </Routes>
);

const montar = () => montarEcra(AS_ROTAS, '/crews/crew-1/tesouraria');

const montarServidor = () =>
    montarEcra(AS_ROTAS, '/servidores/srv-1/tesouraria');

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

/**
 * A tesouraria de um servidor.
 *
 * Não tinha ecrã nenhum. A API trata as duas tesourarias com as mesmas
 * rotas — saldos, movimentos, aprovar, rejeitar — e o cliente desta
 * aplicação já sabia pedir as duas; só faltava a porta. Um servidor a
 * pagar o escalão mais caro não tinha por onde mexer no dinheiro que o
 * plano lhe abria.
 *
 * E a caixa de entrada já mandava para cá as decisões de dinheiro de um
 * servidor: sem a rota, o catch-all despejava quem clicasse na página
 * inicial.
 */
describe('a tesouraria de um servidor', () => {
    const afiliada = (extra: Record<string, unknown> = {}) => ({
        crewId: 'crew-9',
        crewName: 'Vice Kings',
        crewTag: 'VICE',
        status: 'active',
        requestedAt: '2026-01-01T00:00:00.000Z',
        respondedAt: '2026-01-02T00:00:00.000Z',
        ...extra,
    });

    it('abre, em vez de atirar para a página inicial', async () => {
        vi.stubGlobal('fetch', servir({ premium: true }));

        montarServidor();

        expect(await screen.findByText(t.tesouraria.titulo)).toBeDefined();
        expect(screen.getByText('Leonida Life')).toBeDefined();
    });

    /**
     * O coração disto: a tesouraria lida é a **do servidor**.
     *
     * A página monta-se na mesma nas duas rotas, e sem isto nada
     * provava que ela pergunta pelo titular certo — podia estar a
     * mostrar as contas de outra pessoa com o nome desta.
     */
    it('lê a tesouraria do servidor, e não a de uma crew', async () => {
        const fetchMock = servir({ premium: true });

        vi.stubGlobal('fetch', fetchMock);

        montarServidor();

        await waitFor(() => {
            expect(screen.getByText(t.tesouraria.titulo)).toBeDefined();
        });

        const enderecos = fetchMock.mock.calls.map((argumentos) =>
            String(argumentos[0]),
        );

        expect(
            enderecos.some((endereco) =>
                endereco.includes('/treasury/servers/srv-1'),
            ),
        ).toBe(true);
        expect(
            enderecos.some((endereco) => endereco.includes('/treasury/crews/')),
        ).toBe(false);
    });

    /**
     * Sem crew escolhida o pedido não sai. A API recusava-o na mesma,
     * mas com um erro que se lê como avaria em vez de "falta escolher".
     */
    it('não deixa transferir sem escolher para quem', async () => {
        vi.stubGlobal(
            'fetch',
            servir({ premium: true, afiliacoes: [afiliada()] }),
        );

        montarServidor();

        await userEvent.type(
            await screen.findByLabelText(t.tesouraria.montanteAEnviar),
            '250',
        );

        expect(
            screen.getByRole('button', { name: t.tesouraria.transferir }),
        ).toHaveProperty('disabled', true);
    });

    /**
     * Transferir e não ver o saldo mudar é indistinguível de não ter
     * transferido — e aqui o dinheiro mexe-se já, ao contrário de um
     * movimento proposto.
     */
    it('recarrega a tesouraria depois de transferir', async () => {
        const fetchMock = servir({
            premium: true,
            afiliacoes: [afiliada()],
        });

        vi.stubGlobal('fetch', fetchMock);

        montarServidor();

        /* As leituras da tesouraria, sem contar a própria transferência. */
        const leituras = () =>
            fetchMock.mock.calls.filter((argumentos) => {
                const endereco = String(argumentos[0]);

                return (
                    endereco.includes('/treasury/servers/srv-1')
                    && !endereco.includes('/transfers')
                );
            }).length;

        await userEvent.selectOptions(
            await screen.findByLabelText(t.tesouraria.paraQueCrew),
            'crew-9',
        );
        await userEvent.type(
            screen.getByLabelText(t.tesouraria.montanteAEnviar),
            '250',
        );

        const antes = leituras();

        await userEvent.click(
            screen.getByRole('button', { name: t.tesouraria.transferir }),
        );

        await waitFor(() => {
            expect(leituras()).toBeGreaterThan(antes);
        });
    });

    /**
     * Um servidor não reparte o que ganha pelos membros: financia as
     * crews. A API nem tem a rota de divisões para servidores.
     */
    it('transfere para crews, e não divide por membros', async () => {
        vi.stubGlobal(
            'fetch',
            servir({ premium: true, afiliacoes: [afiliada()] }),
        );

        montarServidor();

        expect(
            await screen.findByText(t.tesouraria.transferirTitulo),
        ).toBeDefined();
        expect(screen.queryByText(t.tesouraria.dividirTitulo)).toBeNull();
    });

    it('e uma crew continua a dividir, e não a transferir', async () => {
        vi.stubGlobal('fetch', servir({ premium: true }));

        montar();

        expect(await screen.findByText(t.tesouraria.dividirTitulo)).toBeDefined();
        expect(screen.queryByText(t.tesouraria.transferirTitulo)).toBeNull();
    });

    it('não deixa mexer no dinheiro sem plano', async () => {
        vi.stubGlobal('fetch', servir({ premium: false }));

        montarServidor();

        await waitFor(() => {
            expect(screen.getByText(t.tesouraria.titulo)).toBeDefined();
        });

        expect(screen.queryByText(t.tesouraria.transferirTitulo)).toBeNull();
        expect(screen.getByText(t.tesouraria.precisaDePlano)).toBeDefined();
    });

    /**
     * O plano é **do servidor**. Sem o identificador certo no link,
     * quem carregasse comprava para si próprio e a tesouraria
     * continuava fechada — que é o erro que o link da crew já
     * documenta ao lado.
     */
    it('manda comprar o plano para o servidor, e não para quem clica', async () => {
        vi.stubGlobal('fetch', servir({ premium: false }));

        montarServidor();

        const link = await screen.findByText(t.tesouraria.verPlano);

        expect(link.getAttribute('href')).toBe('/premium?servidor=srv-1');
    });

    /**
     * Uma crew que ainda está a candidatar-se, ou que já saiu, não é
     * destino para dinheiro nenhum: a API recusa-a. Oferecê-la era
     * oferecer uma escolha que só pode falhar.
     */
    it('só oferece as crews que lá jogam mesmo', async () => {
        vi.stubGlobal(
            'fetch',
            servir({
                premium: true,
                afiliacoes: [
                    afiliada(),
                    afiliada({
                        crewId: 'crew-8',
                        crewName: 'Candidata',
                        crewTag: 'CAND',
                        status: 'pending',
                    }),
                    afiliada({
                        crewId: 'crew-7',
                        crewName: 'Saiu',
                        crewTag: 'SAIU',
                        status: 'left',
                    }),
                ],
            }),
        );

        montarServidor();

        expect(await screen.findByText('[VICE] Vice Kings')).toBeDefined();
        expect(screen.queryByText('[CAND] Candidata')).toBeNull();
        expect(screen.queryByText('[SAIU] Saiu')).toBeNull();
    });

    it('diz o que falta quando nenhuma crew lá joga', async () => {
        vi.stubGlobal('fetch', servir({ premium: true, afiliacoes: [] }));

        montarServidor();

        expect(
            await screen.findByText(t.tesouraria.semCrewsNoServidor),
        ).toBeDefined();
    });

    it('transfere para a crew escolhida', async () => {
        const fetchMock = servir({
            premium: true,
            afiliacoes: [afiliada()],
        });

        vi.stubGlobal('fetch', fetchMock);

        montarServidor();

        await userEvent.selectOptions(
            await screen.findByLabelText(t.tesouraria.paraQueCrew),
            'crew-9',
        );
        await userEvent.type(
            screen.getByLabelText(t.tesouraria.montanteAEnviar),
            '250',
        );
        await userEvent.type(
            screen.getByLabelText(t.tesouraria.nota),
            'Para o assalto',
        );
        await userEvent.click(
            screen.getByRole('button', { name: t.tesouraria.transferir }),
        );

        await waitFor(() => {
            expect(screen.getByText(t.tesouraria.transferida)).toBeDefined();
        });

        const pedido = fetchMock.mock.calls.find((argumentos) =>
            String(argumentos[0]).includes('/transfers'),
        );

        expect(String(pedido?.[0])).toContain('/treasury/servers/srv-1/transfers');
        expect(
            JSON.parse(
                String((pedido?.[1] as { body?: string } | undefined)?.body),
            ),
        ).toEqual({
            crewId: 'crew-9',
            amount: '250',
            description: 'Para o assalto',
        });
    });
});

/**
 * Pagar a divisão proposta.
 *
 * A metade que faltava. Propor uma divisão não move dinheiro nenhum —
 * está escrito no ecrã e é verdade —, e até aqui não havia por onde a
 * aprovar: ficava na lista a dizer "pendente" para sempre, com o
 * dinheiro parado na tesouraria e as pessoas à espera da parte delas.
 *
 * A rota da API existia, o cliente sabia chamá-la, e nada no produto o
 * fazia.
 */
describe('pagar uma divisão proposta', () => {
    const pendente = (estado: string) => ({
        id: 'div-9',
        total: '900',
        basis: 'equal',
        status: estado,
        eventId: null,
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
                status: estado,
                description: 'Divisão de ganhos pelos membros',
                requestedBy: 'u1',
                decidedBy: null,
                decidedAt: null,
                createdAt: '2026-02-02T00:00:00.000Z',
            },
        ],
    });

    it('paga a divisão que está à espera de decisão', async () => {
        const fetchMock = servir({
            premium: true,
            divisoes: [pendente('pending')],
        });

        vi.stubGlobal('fetch', fetchMock);
        montar();

        await userEvent.click(await screen.findByText(t.tesouraria.pagar));

        await waitFor(() => {
            expect(
                fetchMock.mock.calls.some(
                    (argumentos) =>
                        String(argumentos[0]).endsWith(
                            '/treasury/crews/crew-1/distributions/div-9/approve',
                        )
                        && (argumentos[1] as RequestInit | undefined)?.method
                            === 'POST',
                ),
            ).toBe(true);
        });
    });

    it('recusa a divisão que não se quer pagar', async () => {
        const fetchMock = servir({
            premium: true,
            divisoes: [pendente('pending')],
        });

        vi.stubGlobal('fetch', fetchMock);
        montar();

        /**
         * Pelo botão dentro da divisão, e não pelo primeiro "recusar"
         * da página: os movimentos têm um com o mesmo nome, e clicar no
         * deles provava outra coisa.
         */
        const linha = (await screen.findByText(t.tesouraria.pagar))
            .closest('li') as HTMLElement;

        await userEvent.click(within(linha).getByText(t.tesouraria.recusar));

        await waitFor(() => {
            expect(
                fetchMock.mock.calls.some((argumentos) =>
                    String(argumentos[0]).endsWith(
                        '/treasury/crews/crew-1/distributions/div-9/reject',
                    ),
                ),
            ).toBe(true);
        });
    });

    /**
     * Uma divisão já decidida não se decide outra vez, e a API
     * responderia 409. Um botão que só pode falhar é pior do que botão
     * nenhum.
     */
    it('não oferece pagar o que já foi pago', async () => {
        vi.stubGlobal(
            'fetch',
            servir({ premium: true, divisoes: [pendente('approved')] }),
        );

        montar();

        expect(await screen.findByText(t.tesouraria.divisoes)).toBeDefined();
        expect(screen.queryByText(t.tesouraria.pagar)).toBeNull();
    });

    /**
     * O mesmo portão do resto do que mexe no dinheiro: sem plano, a
     * divisão continua à vista e os botões não. Ler é de graça.
     */
    it('não oferece pagar sem plano', async () => {
        vi.stubGlobal(
            'fetch',
            servir({ premium: false, divisoes: [pendente('pending')] }),
        );

        montar();

        expect(await screen.findByText(t.tesouraria.divisoes)).toBeDefined();
        expect(screen.queryByText(t.tesouraria.pagar)).toBeNull();
    });
});
