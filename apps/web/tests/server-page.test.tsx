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
    isOnline: true,
    isPremium: false,
    appearance: { bannerUrl: null, accentColor: null },
    memberCount: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
};

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

        if (endereco.endsWith('/requests')) {
            return Promise.resolve(opcoes.requests);
        }

        if (endereco.endsWith('/members')) {
            return Promise.resolve(json(200, []));
        }

        if (endereco.endsWith('/me/memberships')) {
            return Promise.resolve(json(200, []));
        }

        return Promise.resolve(
            json(200, { ...perfil, isPremium: opcoes.premium === true }),
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
