import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

import { AuthProvider } from '../src/auth/auth.context.js';
import { CrewPage } from '../src/crews/pages/crew.page.js';
import { montarEcra, t } from './helpers.js';

const perfil = {
    id: 'crew-1',
    name: 'Vice Kings',
    tag: 'VICE',
    description: 'A crew do teste.',
    level: 100,
    xp: '9007199254740993',
    levelXp: '495000',
    nextLevelXp: null,
    rank: { position: 3, of: 12 },
    influence: 12,
    prestige: 3,
    isPremium: false,
    premiumVia: null,
    appearance: { bannerUrl: null, accentColor: null },
    memberCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
};

/**
 * A lista de membros diz o cargo, e o cargo decide o que aparece.
 *
 * São duas listas porque gerir membros e mandar na crew são coisas
 * diferentes: um oficial tem `crew:manage_members` e não tem
 * `crew:manage`. Uma lista só, com u1 sempre líder, dizia ao ecrã que
 * quem está a ver manda na crew mesmo nos casos escritos para provar o
 * contrário.
 */
const membros = [
    { userId: 'u1', username: 'lider', avatarUrl: null, role: 'crew_leader', joinedAt: '2026-01-01T00:00:00.000Z' },
    { userId: 'u2', username: 'outro', avatarUrl: null, role: 'crew_member', joinedAt: '2026-01-02T00:00:00.000Z' },
];

/** A mesma crew vista por quem lá está sem mandar nela. */
const membrosSemMandar = [
    { userId: 'u2', username: 'lider', avatarUrl: null, role: 'crew_leader', joinedAt: '2026-01-01T00:00:00.000Z' },
    { userId: 'u1', username: 'outro', avatarUrl: null, role: 'crew_member', joinedAt: '2026-01-02T00:00:00.000Z' },
];

/** De onde veio o xp desta crew, como a API o devolve. */
const ganhos = [
    {
        id: 'xp-2',
        amount: 100,
        reason: 'event_completed',
        at: '2026-02-02T20:00:00.000Z',
        event: { id: 'evento-2', name: 'Assalto ao banco' },
    },
    {
        id: 'xp-1',
        amount: 75,
        reason: 'event_completed',
        at: '2026-02-01T20:00:00.000Z',
        event: null,
    },
];

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

/**
 * Encaminha cada rota da API para o que este teste quer que ela
 * responda. `requests` é o que muda entre os casos: 403 para quem não
 * gere membros, uma lista para quem gere.
 */
const servidor = (opcoes: {
    requests: Response;
    memberships?: unknown;
    premium?: boolean;
    patch?: Response;
    /** O que a lista de ganhos de xp responde. Por omissão, dois ganhos. */
    xp?: Response;
    /** O perfil, quando o caso o quer diferente do normal. */
    perfil?: Record<string, unknown>;
    /** De onde vem o plano, quando não é da própria crew. */
    via?: { kind: 'server'; id: string; name: string };
}) =>
    vi.fn((url: string, init?: { method?: string }) => {
        const endereco = String(url);

        /** O que a alteração responde, quando o caso a quer a falhar. */
        if (init?.method === 'PATCH' && opcoes.patch !== undefined) {
            return Promise.resolve(opcoes.patch);
        }

        /*
         * O AuthProvider troca o cookie por um access token ao arrancar.
         * Sem esta rota o contexto ficava sem utilizador, e os testes
         * passavam pela razão errada: o ecrã escondia os botões de
         * gestão por não haver sessão, e não por falta de permissão.
         */
        if (endereco.endsWith('/auth/refresh')) {
            return Promise.resolve(
                json(200, {
                    accessToken: 'token',
                    user: {
                        id: 'u1',
                        email: 'lider@vicehub.test',
                        username: 'lider',
                    },
                }),
            );
        }

        if (endereco.endsWith('/requests')) {
            return Promise.resolve(opcoes.requests);
        }

        /**
         * O xp exige `event:read`, que **qualquer membro** tem — e não
         * `crew:manage_members`, que é o que decide as candidaturas. São
         * duas permissões diferentes de propósito: um membro comum não
         * vê quem se candidatou, mas vê de onde veio o nível da crew.
         */
        if (endereco.endsWith('/xp')) {
            return Promise.resolve(opcoes.xp ?? json(200, ganhos));
        }

        /**
         * Quem lidera não pode levar 403 nas candidaturas — tem sempre
         * `crew:manage_members`. Fazer as duas respostas sair da mesma
         * opção impede um cenário impossível: um líder a quem a API
         * recusa a lista dos candidatos.
         */
        if (endereco.endsWith('/members')) {
            return Promise.resolve(
                json(200, opcoes.requests.status === 200 ? membros : membrosSemMandar),
            );
        }

        if (endereco.includes('/affiliation')) {
            return Promise.resolve(json(200, { server: null, pending: null }));
        }

        if (endereco.endsWith('/me/memberships')) {
            return Promise.resolve(json(200, opcoes.memberships ?? []));
        }

        return Promise.resolve(
            json(200, {
                ...(opcoes.perfil ?? perfil),
                isPremium: opcoes.premium === true,
                premiumVia: opcoes.via ?? null,
            }),
        );
    });

/** O corpo com que o perfil da crew foi alterado. */
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
                <Route path="/crews/:crewId" element={<CrewPage />} />
            </Routes>
        </AuthProvider>,
        '/crews/crew-1',
    );

describe('o ecrã de uma crew', () => {

    /**
     * Quem gere membros descobre-se perguntando à API, e não deduzindo
     * de outra coisa: o 403 nas candidaturas **é** a resposta. Assim, o
     * que o ecrã mostra é sempre a permissão real.
     */
    describe('quem não gere membros', () => {
        beforeEach(() => {
            vi.stubGlobal(
                'fetch',
                servidor({ requests: json(403, { code: 'FORBIDDEN' }) }),
            );
        });

        it('não mostra botões de gestão', async () => {
            montar();

            await waitFor(() => {
                expect(screen.getByText('Vice Kings')).toBeDefined();
            });

            expect(screen.queryByRole('button', { name: t.crews.remover })).toBeNull();
            expect(screen.queryByText(t.crews.candidaturasPorResponder)).toBeNull();
        });

        /**
         * Um 403 esperado não é uma avaria: não pode aparecer como erro
         * a quem só está a ver a crew.
         */
        it('não trata o 403 como avaria', async () => {
            montar();

            await waitFor(() => {
                expect(screen.getByText('Vice Kings')).toBeDefined();
            });

            expect(screen.queryByRole('alert')).toBeNull();
        });

        it('mostra os membros na mesma', async () => {
            montar();

            await waitFor(() => {
                expect(screen.getByText('outro')).toBeDefined();
            });

            expect(screen.getByText(t.cargos.crew_leader)).toBeDefined();
        });
    });

    /**
     * O `PATCH /crews/:crewId` existia na API desde o princípio e não
     * havia por onde lá chegar. O nome é único: um mal escrito ficava
     * mal escrito, e nem criar outra crew resolvia.
     */
    describe('as definições da crew', () => {
        it('não aparecem a quem não gere a crew', async () => {
            vi.stubGlobal(
                'fetch',
                servidor({ requests: json(403, { code: 'FORBIDDEN' }) }),
            );

            montar();

            await waitFor(() => {
                expect(screen.getByText('Vice Kings')).toBeDefined();
            });

            expect(screen.queryByLabelText(t.crews.nome)).toBeNull();
        });

        it('aparecem a quem gere, já preenchidas', async () => {
            vi.stubGlobal('fetch', servidor({ requests: json(200, []) }));

            montar();

            const nome = (await screen.findByLabelText(
                t.crews.nome,
            )) as HTMLInputElement;

            expect(nome.value).toBe('Vice Kings');
        });

        /**
         * Um campo vazio limpa o valor em vez de o deixar como estava.
         * Sem essa distinção não havia forma de apagar uma descrição
         * depois de a ter escrito.
         */
        it('manda a descrição vazia como null, e não como texto vazio', async () => {
            const fetchMock = servidor({ requests: json(200, []) });
            vi.stubGlobal('fetch', fetchMock);

            montar();

            const descricao = await screen.findByLabelText(t.crews.descricao);

            await userEvent.clear(descricao);
            await userEvent.click(
                screen.getByRole('button', { name: t.comum.guardar }),
            );

            await waitFor(() => {
                expect(corpoDoPatch(fetchMock)).toMatchObject({
                    description: null,
                });
            });
        });

        /**
         * O 409 mais provável neste formulário é o nome já existir. A
         * mensagem da API vem numa língua só; quem lê noutra tem de
         * receber a sua.
         */
        it('diz na língua de quem lê que o nome já existe', async () => {
            vi.stubGlobal(
                'fetch',
                servidor({
                    requests: json(200, []),
                    patch: json(409, { code: 'CREW_NAME_TAKEN', message: 'Já existe uma crew com este nome.' }),
                }),
            );

            montar();

            const nome = await screen.findByLabelText(t.crews.nome);

            await userEvent.clear(nome);
            await userEvent.type(nome, 'Outra Crew');
            await userEvent.click(
                screen.getByRole('button', { name: t.comum.guardar }),
            );

            expect(await screen.findByText(t.crews.nomeJaExiste)).toBeDefined();
        });
    });

    describe('de onde vem o plano', () => {
        /**
         * Uma crew coberta pelo servidor onde joga tem de saber de quem
         * é o plano: sem isso, o dia em que sair de lá perde a
         * personalização sem explicação nenhuma.
         */
        it('diz que o plano vem do servidor onde a crew joga', async () => {
            vi.stubGlobal(
                'fetch',
                servidor({
                    requests: json(200, []),
                    premium: true,
                    via: {
                        kind: 'server',
                        id: 'server-1',
                        name: 'Vice City RP',
                    },
                }),
            );

            montar();

            expect(
                await screen.findByText(t.crews.planoVemDoServidor, {
                    exact: false,
                }),
            ).toBeDefined();
            expect(screen.queryByText(t.crews.planoAtivo)).toBeNull();
        });

        it('com plano próprio, não fala de servidor nenhum', async () => {
            vi.stubGlobal(
                'fetch',
                servidor({ requests: json(200, []), premium: true }),
            );

            montar();

            expect(await screen.findByText(t.crews.planoAtivo)).toBeDefined();
        });
    });

    /**
     * A personalização é o que o plano da crew desbloqueia. Aparece a
     * quem a gere com plano ou sem ele: escondê-la sem plano faria com
     * que quem viesse a tê-lo não soubesse que ganhou alguma coisa.
     */
    describe('a personalização da crew', () => {
        it('não aparece a quem não gere a crew', async () => {
            vi.stubGlobal(
                'fetch',
                servidor({ requests: json(403, { code: 'FORBIDDEN' }) }),
            );

            montar();

            await waitFor(() => {
                expect(screen.getByText('Vice Kings')).toBeDefined();
            });

            expect(screen.queryByLabelText(t.perfil.banner)).toBeNull();
        });

        it('aparece a quem gere, mesmo sem plano', async () => {
            vi.stubGlobal('fetch', servidor({ requests: json(200, []) }));

            montar();

            expect(await screen.findByLabelText(t.perfil.banner)).toBeDefined();
            expect(screen.getByText(t.crews.precisaDePlano)).toBeDefined();
        });

        /**
         * O plano é **da crew**, e não de quem a gere. Sem o
         * identificador no endereço, quem carregasse comprava para si
         * próprio e a crew continuava sem nada — e ninguém repararia até
         * ir procurar a personalização, que continuava recusada.
         */
        it('manda comprar o plano para a crew, e não para quem gere', async () => {
            vi.stubGlobal('fetch', servidor({ requests: json(200, []) }));

            montar();

            const link = await screen.findByText(t.crews.verPremium);

            expect(link.getAttribute('href')).toBe('/premium?crew=crew-1');
        });

        it('com plano, não insiste em vendê-lo', async () => {
            vi.stubGlobal(
                'fetch',
                servidor({ requests: json(200, []), premium: true }),
            );

            montar();

            expect(await screen.findByText(t.crews.planoAtivo)).toBeDefined();
            expect(screen.queryByText(t.crews.verPremium)).toBeNull();
        });
    });

    describe('quem gere membros', () => {
        beforeEach(() => {
            vi.stubGlobal(
                'fetch',
                servidor({
                    requests: json(200, [
                        {
                            userId: 'u9',
                            username: 'candidato',
                            avatarUrl: null,
                            requestedAt: '2026-02-01T00:00:00.000Z',
                        },
                    ]),
                    memberships: [
                        {
                            crewId: 'crew-1',
                            name: 'Vice Kings',
                            tag: 'VICE',
                            status: 'active',
                            role: 'crew_leader',
                            since: '2026-01-01T00:00:00.000Z',
                        },
                    ],
                }),
            );
        });

        it('mostra as candidaturas por responder', async () => {
            montar();

            await waitFor(() => {
                expect(screen.getByText('candidato')).toBeDefined();
            });

            expect(screen.getByRole('button', { name: t.crews.aceitar })).toBeDefined();
            expect(screen.getByRole('button', { name: t.crews.recusar })).toBeDefined();
        });

        /**
         * Remover-se a si próprio não é sair da crew — é uma forma de a
         * deixar sem líder por engano.
         */
        it('não deixa remover-se a si próprio', async () => {
            montar();

            await waitFor(() => {
                expect(screen.getByText('outro')).toBeDefined();
            });

            expect(screen.getAllByRole('button', { name: t.crews.remover })).toHaveLength(1);
        });
    });

    /**
     * O xp é BigInt na base de dados e chega como string. Passá-lo por
     * Number perderia o valor exato acima dos 9 mil biliões.
     */
    it('mostra o xp tal como veio, sem o converter', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({ requests: json(403, { code: 'FORBIDDEN' }) }),
        );

        montar();

        await waitFor(() => {
            expect(screen.getByText('9007199254740993')).toBeDefined();
        });
    });

    /**
     * De onde veio o nível.
     *
     * A lista é a razão de o xp ser gravado como factos: um total
     * sozinho só se pode acreditar.
     */
    describe('de onde veio o xp', () => {
        it('mostra cada ganho, com o evento de onde veio', async () => {
            vi.stubGlobal(
                'fetch',
                servidor({ requests: json(403, { code: 'FORBIDDEN' }) }),
            );

            montar();

            await waitFor(() => {
                expect(screen.getByText(t.progressao.historico)).toBeDefined();
            });

            expect(screen.getByText('+100')).toBeDefined();
            expect(
                screen.getByRole('link', { name: 'Assalto ao banco' }),
            ).toBeDefined();
        });

        /**
         * Apagar um evento não apaga o xp que ele deu — o que aconteceu,
         * aconteceu — mas deixa de haver para onde apontar.
         */
        it('diz que o evento já não existe, em vez de um link partido', async () => {
            vi.stubGlobal(
                'fetch',
                servidor({ requests: json(403, { code: 'FORBIDDEN' }) }),
            );

            montar();

            await waitFor(() => {
                expect(screen.getByText('+75')).toBeDefined();
            });

            expect(screen.getByText(t.progressao.eventoApagado)).toBeDefined();
        });

        /**
         * Quem não pertence leva 403 — a lista diz os nomes dos eventos,
         * e o calendário de uma comunidade é dela. Um 403 não é avaria:
         * a secção não aparece, e mais nada.
         */
        it('esconde a secção a quem a API recusa, sem mostrar erro', async () => {
            vi.stubGlobal(
                'fetch',
                servidor({
                    requests: json(403, { code: 'FORBIDDEN' }),
                    xp: json(403, { code: 'FORBIDDEN' }),
                }),
            );

            montar();

            await waitFor(() => {
                expect(screen.getByText('Vice Kings')).toBeDefined();
            });

            expect(screen.queryByText(t.progressao.historico)).toBeNull();
            expect(screen.queryByRole('alert')).toBeNull();
        });
    });

    /**
     * O lugar na classificação.
     *
     * Só existe para quem já ganhou alguma coisa: uma crew sem xp não
     * está em último — não entrou ainda.
     */
    describe('o lugar', () => {
        it('mostra a posição e entre quantas', async () => {
            vi.stubGlobal(
                'fetch',
                servidor({ requests: json(403, { code: 'FORBIDDEN' }) }),
            );

            montar();

            await waitFor(() => {
                expect(screen.getByText(t.crews.lugar(3, 12))).toBeDefined();
            });
        });

        it('não mostra lugar nenhum a uma crew que ainda não ganhou xp', async () => {
            vi.stubGlobal(
                'fetch',
                servidor({
                    requests: json(403, { code: 'FORBIDDEN' }),
                    perfil: { ...perfil, rank: null },
                }),
            );

            montar();

            await waitFor(() => {
                expect(screen.getByText('Vice Kings')).toBeDefined();
            });

            expect(screen.queryByText(/#/)).toBeNull();
        });
    });
});
