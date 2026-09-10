import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

import { AuthProvider } from '../src/auth/auth.context.js';
import { ServerPage } from '../src/servers/pages/server.page.js';
import { montarEcra, t } from './helpers.js';

const perfil = {
    id: 'server-1',
    name: 'Vice City RP',
    region: 'EU',
    description: 'O servidor do teste.',
    joinRequirements: null,
    isOnline: true,
    playersOnline: null,
    reportsItself: false,
    isPremium: false,
    appearance: { bannerUrl: null, accentColor: null },
    memberCount: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
};

/**
 * O cargo decide o que aparece: um moderador tem
 * `server:manage_members` e não tem `server:manage`, e por isso não vê
 * as definições nem responde a pedidos de filiação. As duas listas
 * existem para que o cenário "não mando nisto" seja coerente com a
 * resposta às candidaturas.
 */
const membros = [
    { userId: 'u1', username: 'dono', avatarUrl: null, role: 'server_owner', joinedAt: '2026-01-01T00:00:00.000Z' },
];

const membrosSemMandar = [
    { userId: 'u2', username: 'dono', avatarUrl: null, role: 'server_owner', joinedAt: '2026-01-01T00:00:00.000Z' },
    { userId: 'u1', username: 'visita', avatarUrl: null, role: 'server_member', joinedAt: '2026-01-02T00:00:00.000Z' },
];

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

/**
 * O 403 nas candidaturas **é** a resposta a "és tu que geres isto?".
 * O ecrã pergunta à API em vez de deduzir o cargo de outro sítio, e é
 * essa resposta que decide o que aparece.
 */
const servidor = (opcoes: {
    requests: Response;
    premium?: boolean;
    patch?: Response;
    /** Um perfil diferente do normal, para os casos que o exigem. */
    perfil?: unknown;
    /** As adesões de quem está a ver, quando o caso precisa de uma. */
    adesoes?: unknown[];
    /** A folga de crews do plano do servidor. */
    folga?: { used: number; limit: number | null; canAcceptMore: boolean };
    /** As crews que pediram para jogar no servidor. */
    pedidosDeCrews?: unknown[];
}) =>
    vi.fn((url: string, init?: { method?: string }) => {
        const endereco = String(url);

        /** O que a alteração responde, quando o caso a quer a falhar. */
        if (init?.method === 'PATCH' && opcoes.patch !== undefined) {
            return Promise.resolve(opcoes.patch);
        }

        if (endereco.endsWith('/auth/refresh')) {
            return Promise.resolve(
                json(200, {
                    accessToken: 'token',
                    user: { id: 'u1', email: 'dono@vicehub.test', username: 'dono' },
                }),
            );
        }

        /**
         * As candidaturas de crews vêm **antes** das de pessoas, e não
         * depois: `/affiliations/requests` também acaba em `/requests`,
         * e um ramo genérico servia a mesma lista às duas caixas de
         * entrada — o ecrã ficava com dois botões "Accept" iguais, um
         * deles a responder à pergunta errada.
         */
        if (endereco.endsWith('/affiliations/requests')) {
            return Promise.resolve(
                opcoes.requests.status === 200
                    ? json(200, opcoes.pedidosDeCrews ?? [])
                    : opcoes.requests,
            );
        }

        if (endereco.endsWith('/requests')) {
            return Promise.resolve(opcoes.requests);
        }

        if (endereco.endsWith('/members')) {
            return Promise.resolve(
                json(200, opcoes.requests.status === 200 ? membros : membrosSemMandar),
            );
        }

        /**
         * A folga do plano vem **antes** da lista de filiações, e não
         * depois: `/affiliations/allowance` também contém
         * `/affiliations`, e um ramo genérico respondia-lhe com uma
         * lista vazia. O componente lia `limit` de um array, não
         * encontrava nada, e mostrava a conta com buracos — em silêncio,
         * com os testes todos a passar.
         */
        if (endereco.includes('/affiliations/allowance')) {
            return Promise.resolve(
                json(
                    200,
                    opcoes.folga ?? {
                        used: 0,
                        limit: 3,
                        canAcceptMore: true,
                    },
                ),
            );
        }

        if (endereco.includes('/affiliations')) {
            return Promise.resolve(json(200, []));
        }

        if (endereco.endsWith('/me/memberships')) {
            return Promise.resolve(json(200, opcoes.adesoes ?? []));
        }

        return Promise.resolve(
            json(200, {
                ...perfil,
                ...(opcoes.perfil ?? {}),
                isPremium: opcoes.premium === true,
            }),
        );
    });

const corpoDoPatch = (fetchMock: ReturnType<typeof vi.fn>): unknown => {
    const chamada = fetchMock.mock.calls.find(
        (argumentos) =>
            (argumentos[1] as { method?: string } | undefined)?.method === 'PATCH',
    );

    return JSON.parse(
        String((chamada?.[1] as { body?: string } | undefined)?.body ?? '{}'),
    );
};

const montar = () =>
    montarEcra(
        <AuthProvider>
            <Routes>
                <Route path="/servidores/:serverId" element={<ServerPage />} />
            </Routes>
        </AuthProvider>,
        '/servidores/server-1',
    );

afterEach(() => {
    vi.unstubAllGlobals();
});

/**
 * O estado online aparece no perfil e é por ele que o diretório filtra.
 * Sem estas definições alcançáveis, dizia sempre o mesmo e ninguém o
 * podia corrigir — o filtro "só online" mostrava servidores offline e
 * escondia os que estavam de pé.
 */
describe('as definições de um servidor', () => {
    it('não aparecem a quem não gere o servidor', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({ requests: json(403, { code: 'FORBIDDEN' }) }),
        );

        montar();

        await waitFor(() => {
            expect(screen.getByText('Vice City RP')).toBeDefined();
        });

        expect(screen.queryByLabelText(t.servidores.estaOnline)).toBeNull();
    });

    it('aparecem a quem gere, com o estado atual', async () => {
        vi.stubGlobal('fetch', servidor({ requests: json(200, []) }));

        montar();

        const caixa = (await screen.findByLabelText(
            t.servidores.estaOnline,
        )) as HTMLInputElement;

        expect(caixa.checked).toBe(true);
    });

    it('deixa marcar o servidor como offline', async () => {
        const fetchMock = servidor({ requests: json(200, []) });
        vi.stubGlobal('fetch', fetchMock);

        montar();

        await userEvent.click(
            await screen.findByLabelText(t.servidores.estaOnline),
        );
        await userEvent.click(
            screen.getByRole('button', { name: t.comum.guardar }),
        );

        await waitFor(() => {
            expect(corpoDoPatch(fetchMock)).toMatchObject({ isOnline: false });
        });
    });

    /**
     * A partir do momento em que o servidor reporta por si, a marca
     * manual deixa de decidir. Continuar a mostrá-la seria oferecer um
     * botão que não faz nada — e alguém desligá-lo-ia e o servidor
     * continuava online, sem perceber porquê.
     */
    it('esconde a marca manual num servidor que reporta por si', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({
                requests: json(200, []),
                perfil: { ...perfil, reportsItself: true },
            }),
        );

        montar();

        expect(await screen.findByLabelText(t.servidores.nome)).toBeDefined();
        expect(screen.queryByLabelText(t.servidores.estaOnline)).toBeNull();
        expect(screen.getByText(t.servidores.reportaPorSi)).toBeDefined();
    });

    /**
     * A região vem vazia em muitos servidores, e vazia tem de significar
     * "sem região" — não uma cadeia vazia que a API recusaria.
     */
    it('manda a região vazia como null', async () => {
        const fetchMock = servidor({ requests: json(200, []) });
        vi.stubGlobal('fetch', fetchMock);

        montar();

        await userEvent.clear(await screen.findByLabelText(t.servidores.regiao));
        await userEvent.click(
            screen.getByRole('button', { name: t.comum.guardar }),
        );

        await waitFor(() => {
            expect(corpoDoPatch(fetchMock)).toMatchObject({ region: null });
        });
    });

    /**
     * O 409 mais provável neste formulário é o nome já existir. A
     * mensagem da API vem numa língua só; quem lê noutra tem de receber
     * a sua.
     */
    it('diz na língua de quem lê que o nome já existe', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({
                requests: json(200, []),
                patch: json(409, {
                    code: 'SERVER_NAME_TAKEN',
                    message: 'Já existe um servidor com este nome.',
                }),
            }),
        );

        montar();

        const nome = await screen.findByLabelText(t.servidores.nome);

        await userEvent.clear(nome);
        await userEvent.type(nome, 'Outro Servidor');
        await userEvent.click(
            screen.getByRole('button', { name: t.comum.guardar }),
        );

        expect(await screen.findByText(t.servidores.nomeJaExiste)).toBeDefined();
    });
});

/**
 * O mesmo que na crew, e pela mesma razão: a personalização é o que o
 * plano desbloqueia, e aparece a quem gere o servidor com plano ou sem
 * ele — escondê-la sem plano faria com que quem viesse a tê-lo não
 * soubesse que ganhou alguma coisa.
 */
describe('a personalização de um servidor', () => {
    it('não aparece a quem não gere o servidor', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({ requests: json(403, { code: 'FORBIDDEN' }) }),
        );

        montar();

        await waitFor(() => {
            expect(screen.getByText('Vice City RP')).toBeDefined();
        });

        expect(screen.queryByLabelText(t.perfil.banner)).toBeNull();
    });

    it('aparece a quem gere, mesmo sem plano', async () => {
        vi.stubGlobal('fetch', servidor({ requests: json(200, []) }));

        montar();

        expect(await screen.findByLabelText(t.perfil.banner)).toBeDefined();
        expect(screen.getByText(t.servidores.precisaDePlano)).toBeDefined();
    });

    /**
     * O plano é **do servidor**, e não de quem o gere. Sem o
     * identificador no endereço, quem carregasse comprava para si
     * próprio e o servidor continuava sem nada.
     */
    it('manda comprar o plano para o servidor, e não para quem o gere', async () => {
        vi.stubGlobal('fetch', servidor({ requests: json(200, []) }));

        montar();

        const link = await screen.findByText(t.servidores.verPremium);

        expect(link.getAttribute('href')).toBe('/premium?servidor=server-1');
    });

    it('com plano, não insiste em vendê-lo', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({ requests: json(200, []), premium: true }),
        );

        montar();

        expect(await screen.findByText(t.servidores.planoAtivo)).toBeDefined();
        expect(screen.queryByText(t.servidores.verPremium)).toBeNull();
    });

    /**
     * Os dois formulários — o do perfil e o de uma comunidade — podem
     * existir na mesma sessão, e os `id` dos campos têm de ser
     * distintos, ou o `label` do segundo aponta para o campo do
     * primeiro e o ecrã deixa de ser navegável por teclado.
     */
    it('dá aos campos identificadores só seus', async () => {
        vi.stubGlobal('fetch', servidor({ requests: json(200, []) }));

        montar();

        const banner = await screen.findByLabelText(t.perfil.banner);

        expect(banner.getAttribute('id')).toBe('servidor-banner');
    });
});

/**
 * O que o servidor exige a quem entra é público: quem chega ao perfil
 * está a decidir se se candidata, e é aqui que precisa de o saber.
 */
describe('os requisitos de candidatura de um servidor', () => {
    it('aparecem a quem ainda não pertence ao servidor', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({
                requests: json(403, { code: 'FORBIDDEN' }),
                perfil: {
                    ...perfil,
                    joinRequirements: 'Voz obrigatoria\nSem cheats',
                },
            }),
        );

        montar();

        expect(
            await screen.findByRole('heading', {
                name: t.servidores.requisitos,
            }),
        ).toBeDefined();

        expect(screen.getByText(/Voz obrigatoria/)).toBeDefined();
    });

    /**
     * Sem requisitos escritos não há secção nenhuma. Um cabeçalho vazio
     * dizia "não exigimos nada" — uma afirmação que o servidor nunca
     * fez.
     */
    it('não aparecem quando o servidor não escreveu nenhuns', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({ requests: json(403, { code: 'FORBIDDEN' }) }),
        );

        montar();

        await waitFor(() => {
            expect(screen.getByText('Vice City RP')).toBeDefined();
        });

        expect(
            screen.queryByRole('heading', { name: t.servidores.requisitos }),
        ).toBeNull();
    });

    it('vão no formulário de definições de quem gere', async () => {
        const fetchMock = servidor({ requests: json(200, []) });
        vi.stubGlobal('fetch', fetchMock);

        montar();

        const requisitos = await screen.findByLabelText(
            t.servidores.requisitos,
        );

        await userEvent.type(requisitos, 'Sem cheats');
        await userEvent.click(
            screen.getByRole('button', { name: t.comum.guardar }),
        );

        await waitFor(() => {
            expect(corpoDoPatch(fetchMock)).toMatchObject({
                joinRequirements: 'Sem cheats',
            });
        });
    });

    /** Pelo mesmo motivo da descrição: apagá-los tem de ser possível. */
    it('vazios vão como null', async () => {
        const fetchMock = servidor({
            requests: json(200, []),
            perfil: { ...perfil, joinRequirements: 'Sem cheats' },
        });
        vi.stubGlobal('fetch', fetchMock);

        montar();

        await userEvent.clear(
            await screen.findByLabelText(t.servidores.requisitos),
        );
        await userEvent.click(
            screen.getByRole('button', { name: t.comum.guardar }),
        );

        await waitFor(() => {
            expect(corpoDoPatch(fetchMock)).toMatchObject({
                joinRequirements: null,
            });
        });
    });
});

/**
 * O calendário de um servidor existe desde sempre na API, e durante
 * bastante tempo não existiu porta nenhuma para lá chegar. Estes dois
 * testes são a porta: um diz que ela aparece a quem pertence, o outro
 * que não aparece a quem não pertence — porque a API responde 403 a
 * esse, e um link que dá 403 lê-se como avaria.
 */
describe('o calendário de um servidor', () => {
    const adesaoAtiva = [
        {
            serverId: 'server-1',
            name: 'Vice City RP',
            region: 'EU',
            status: 'active',
            role: 'server_owner',
            since: '2026-01-01T00:00:00.000Z',
            respondedAt: '2026-01-01T00:00:00.000Z',
            decisionNote: null,
        },
    ];

    it('aparece a quem pertence ao servidor', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({ requests: json(200, []), adesoes: adesaoAtiva }),
        );

        montar();

        const ligacao = await screen.findByText(t.crews.eventos);

        expect(ligacao.getAttribute('href')).toBe('/servidores/server-1/eventos');
    });

    it('não aparece a quem não pertence', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({ requests: json(403, { code: 'FORBIDDEN' }) }),
        );

        montar();

        await waitFor(() => {
            expect(screen.getByText('Vice City RP')).toBeDefined();
        });

        expect(screen.queryByText(t.crews.eventos)).toBeNull();
    });
});

/**
 * O limite de crews do plano, no ecrã de quem gere o servidor.
 *
 * Está aqui e não noutro sítio por uma razão de desenho: quem gere olha
 * para esta secção quando vai responder a um pedido, e é aí que a conta
 * tem de estar — dizer-lhe que está cheio **depois** de carregar em
 * aceitar, num erro, é dizer-lho tarde.
 */
describe('a folga de crews de um servidor', () => {
    it('mostra a quem gere quantas tem e quantas pode ter', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({
                requests: json(200, []),
                folga: { used: 7, limit: 10, canAcceptMore: true },
            }),
        );

        montar();

        expect(
            await screen.findByText(t.filiacao.crewsDoPlano(7, 10)),
        ).toBeDefined();
    });

    /**
     * Sem limite não se inventa um número: dizer "900 de null" seria
     * pior do que não dizer nada.
     */
    it('num plano sem limite, diz que não há limite', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({
                requests: json(200, []),
                folga: { used: 900, limit: null, canAcceptMore: true },
            }),
        );

        montar();

        expect(
            await screen.findByText(t.filiacao.crewsSemLimite(900)),
        ).toBeDefined();
    });

    /**
     * O aviso aparece antes de alguém carregar em aceitar, e leva o
     * caminho para o resolver.
     */
    it('avisa e aponta o escalão seguinte quando está cheio', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({
                requests: json(200, []),
                folga: { used: 3, limit: 3, canAcceptMore: false },
            }),
        );

        montar();

        expect(await screen.findByText(t.filiacao.planoCheio)).toBeDefined();

        const link = screen.getByText(t.filiacao.verEscaloes);

        expect(link.getAttribute('href')).toBe('/premium?servidor=server-1');
    });

    it('com lugar ainda, não avisa nada', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({
                requests: json(200, []),
                folga: { used: 1, limit: 3, canAcceptMore: true },
            }),
        );

        montar();

        await waitFor(() => {
            expect(screen.getByText(t.filiacao.crewsDoPlano(1, 3))).toBeDefined();
        });

        expect(screen.queryByText(t.filiacao.planoCheio)).toBeNull();
    });

    /**
     * Deixar carregar num botão que só pode recusar é fazer alguém
     * descobrir pela via difícil o que já lhe estava escrito por cima.
     */
    it('não deixa aceitar mais um pedido quando o plano está cheio', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({
                requests: json(200, []),
                pedidosDeCrews: [
                    {
                        crewId: 'crew-9',
                        crewName: 'Os Atrasados',
                        crewTag: 'ATR',
                        status: 'pending',
                        requestedAt: '2026-01-01T00:00:00.000Z',
                        respondedAt: null,
                    },
                ],
                folga: { used: 3, limit: 3, canAcceptMore: false },
            }),
        );

        montar();

        const aceitar = (await screen.findByRole('button', {
            name: t.filiacao.aceitar,
        })) as HTMLButtonElement;

        expect(aceitar.disabled).toBe(true);
    });

    it('deixa aceitar enquanto houver lugar', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({
                requests: json(200, []),
                pedidosDeCrews: [
                    {
                        crewId: 'crew-9',
                        crewName: 'Os Pontuais',
                        crewTag: 'PNT',
                        status: 'pending',
                        requestedAt: '2026-01-01T00:00:00.000Z',
                        respondedAt: null,
                    },
                ],
                folga: { used: 1, limit: 3, canAcceptMore: true },
            }),
        );

        montar();

        const aceitar = (await screen.findByRole('button', {
            name: t.filiacao.aceitar,
        })) as HTMLButtonElement;

        expect(aceitar.disabled).toBe(false);
    });

    /**
     * O escalão que um servidor paga não é assunto de quem passa por lá,
     * e a API recusa-o a mais alguém: o painel nem chega a perguntar.
     */
    it('não mostra a folga a quem não gere o servidor', async () => {
        const fetchMock = servidor({ requests: json(403, { code: 'FORBIDDEN' }) });
        vi.stubGlobal('fetch', fetchMock);

        montar();

        await waitFor(() => {
            expect(screen.getByText('Vice City RP')).toBeDefined();
        });

        expect(screen.queryByText(t.filiacao.crewsDoPlano(0, 3))).toBeNull();

        expect(
            fetchMock.mock.calls.filter((argumentos) =>
                String(argumentos[0]).includes('/allowance'),
            ),
        ).toHaveLength(0);
    });
});
