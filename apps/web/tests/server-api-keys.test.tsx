import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ServerApiKeys } from '../src/servers/components/server-api-keys.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const CHAVE = {
    id: 'key-1',
    label: 'produção',
    prefix: 'ab12cd34',
    lastUsedAt: null,
    revokedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
};

const servidor = (opcoes: { chaves?: unknown[]; criada?: unknown } = {}) =>
    vi.fn((_url: string, init?: { method?: string }) => {
        if (init?.method === 'POST') {
            return Promise.resolve(
                json(
                    201,
                    opcoes.criada ?? {
                        ...CHAVE,
                        key: 'vh_ab12cd34_um-segredo-muito-comprido',
                    },
                ),
            );
        }

        if (init?.method === 'DELETE') {
            return Promise.resolve(json(204, null));
        }

        return Promise.resolve(json(200, opcoes.chaves ?? []));
    });

afterEach(() => {
    vi.unstubAllGlobals();
});

/**
 * O painel das chaves de um servidor.
 *
 * O que estes testes guardam é a promessa que a plataforma faz sobre
 * elas: **a chave inteira aparece uma vez**. Se a listagem a mostrasse
 * outra vez, era porque estava guardada — e a razão de ser de tudo isto
 * é não estar.
 */
describe('as chaves de um servidor', () => {
    it('mostra a chave inteira depois de a criar', async () => {
        vi.stubGlobal('fetch', servidor());

        montarEcra(<ServerApiKeys serverId="server-1" />);

        await userEvent.type(
            await screen.findByLabelText(t.chaves.nome),
            'produção',
        );
        await userEvent.click(
            screen.getByRole('button', { name: t.chaves.criar }),
        );

        expect(
            await screen.findByText('vh_ab12cd34_um-segredo-muito-comprido'),
        ).toBeDefined();
        expect(screen.getByText(t.chaves.copiaAgora)).toBeDefined();
    });

    /**
     * A listagem traz o prefixo, e o prefixo não serve para entrar. Se
     * um dia trouxesse a chave, este teste cai.
     */
    it('a listagem mostra o prefixo e nunca uma chave inteira', async () => {
        const { container } = montarEcra(<></>);

        vi.stubGlobal('fetch', servidor({ chaves: [CHAVE] }));

        montarEcra(<ServerApiKeys serverId="server-1" />);

        expect(await screen.findByText('ab12cd34')).toBeDefined();
        expect(container.textContent).not.toContain('vh_ab12cd34_');
    });

    it('não pede uma chave sem nome', async () => {
        vi.stubGlobal('fetch', servidor());

        montarEcra(<ServerApiKeys serverId="server-1" />);

        const botao = await screen.findByRole('button', {
            name: t.chaves.criar,
        });

        expect(botao.hasAttribute('disabled')).toBe(true);
    });

    it('revoga pela rota da chave', async () => {
        const fetchMock = servidor({ chaves: [CHAVE] });
        vi.stubGlobal('fetch', fetchMock);

        montarEcra(<ServerApiKeys serverId="server-1" />);

        await userEvent.click(
            await screen.findByRole('button', { name: t.chaves.revogar }),
        );

        await waitFor(() => {
            const chamada = fetchMock.mock.calls.find(
                (argumentos) =>
                    (argumentos[1] as { method?: string } | undefined)
                        ?.method === 'DELETE',
            );

            expect(String(chamada?.[0])).toMatch(
                /\/servers\/server-1\/api-keys\/key-1$/,
            );
        });
    });

    /**
     * Uma chave revogada continua na lista — quem for ver porque é que
     * um script deixou de funcionar precisa de a encontrar —, mas já
     * não se revoga outra vez.
     */
    it('uma chave revogada aparece sem botão de revogar', async () => {
        vi.stubGlobal(
            'fetch',
            servidor({
                chaves: [{ ...CHAVE, revokedAt: '2026-02-01T00:00:00.000Z' }],
            }),
        );

        montarEcra(<ServerApiKeys serverId="server-1" />);

        expect(await screen.findByText(t.chaves.revogada)).toBeDefined();
        expect(screen.queryByRole('button', { name: t.chaves.revogar })).toBeNull();
    });
});
