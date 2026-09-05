import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router';

import { AuthProvider } from '../src/auth/auth.context.js';
import { CrewPage } from '../src/crews/pages/crew.page.js';
import { montarEcra, t } from './helpers.js';

const perfil = {
    id: 'crew-1',
    name: 'Vice Kings',
    tag: 'VICE',
    description: 'A crew do teste.',
    level: 4,
    xp: '9007199254740993',
    influence: 12,
    prestige: 3,
    isPremium: false,
    appearance: { bannerUrl: null, accentColor: null },
    memberCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
};

const membros = [
    { userId: 'u1', username: 'lider', avatarUrl: null, role: 'crew_leader', joinedAt: '2026-01-01T00:00:00.000Z' },
    { userId: 'u2', username: 'outro', avatarUrl: null, role: 'crew_member', joinedAt: '2026-01-02T00:00:00.000Z' },
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
}) =>
    vi.fn((url: string) => {
        const endereco = String(url);

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

        if (endereco.endsWith('/members')) {
            return Promise.resolve(json(200, membros));
        }

        if (endereco.endsWith('/me/memberships')) {
            return Promise.resolve(json(200, opcoes.memberships ?? []));
        }

        return Promise.resolve(
            json(200, { ...perfil, isPremium: opcoes.premium === true }),
        );
    });

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
});
