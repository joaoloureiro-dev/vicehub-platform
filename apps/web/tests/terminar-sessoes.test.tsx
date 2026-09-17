import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TerminarSessoes } from '../src/profile/components/terminar-sessoes.js';
import { sessionStore } from '../src/lib/session.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

/**
 * Terminar a sessão em todo o lado.
 *
 * A rota existia na API desde o princípio e não tinha por onde ser
 * chamada. Quem desconfiasse que lhe tinham apanhado a conta só podia
 * trocar a password — e trocar a password não põe fora quem já está lá
 * dentro.
 */
describe('terminar sessão em todo o lado', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        sessionStore.clear();
    });

    const carregar = async () => {
        montarEcra(<TerminarSessoes />);

        await userEvent.click(
            screen.getByText(t.perfil.terminarSessoesConfirmar),
        );
    };

    it('pede à API para terminar todas as sessões', async () => {
        const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
            Promise.resolve(json(204, null)),
        );

        vi.stubGlobal('fetch', fetchMock);

        await carregar();

        await waitFor(() => {
            const chamada = fetchMock.mock.calls.find((argumentos) =>
                String(argumentos[0]).endsWith('/auth/logout-all'),
            );

            expect(chamada).toBeDefined();
            expect(
                (chamada?.[1] as { method?: string } | undefined)?.method,
            ).toBe('POST');
        });
    });

    /**
     * A sessão desta aba também acaba: a API invalida os access tokens
     * já emitidos, este incluído. Deixar a memória local a dizer que há
     * alguém dentro dava um 401 sem explicação no primeiro sítio a que
     * se fosse.
     */
    it('limpa a sessão deste dispositivo também', async () => {
        sessionStore.set('token-antigo', {
            id: 'u1',
            email: 'jogador@vicehub.test',
            username: 'jogador',
        });

        vi.stubGlobal(
            'fetch',
            vi.fn((_url: string, _init?: RequestInit) =>
                Promise.resolve(json(204, null)),
            ),
        );

        await carregar();

        await waitFor(() => {
            expect(sessionStore.getUser()).toBeNull();
            expect(sessionStore.getAccessToken()).toBeNull();
        });
    });

    /**
     * E limpa-a mesmo que o pedido falhe. Ficar com ar de autenticado
     * depois de carregar em "terminar em todo o lado" é a pior das duas
     * respostas possíveis a uma falha de rede — a pessoa está ali
     * precisamente porque acha que a conta não é só dela.
     */
    it('limpa a sessão local mesmo quando o pedido falha', async () => {
        sessionStore.set('token-antigo', {
            id: 'u1',
            email: 'jogador@vicehub.test',
            username: 'jogador',
        });

        vi.stubGlobal(
            'fetch',
            vi.fn((_url: string, _init?: RequestInit) =>
                Promise.resolve(json(500, { code: 'INTERNAL' })),
            ),
        );

        await carregar();

        await waitFor(() => {
            expect(sessionStore.getUser()).toBeNull();
            expect(sessionStore.getAccessToken()).toBeNull();
        });
    });

    it('diz que não conseguiu, quando não conseguiu', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn((_url: string, _init?: RequestInit) =>
                Promise.resolve(json(500, { code: 'INTERNAL' })),
            ),
        );

        await carregar();

        expect(
            await screen.findByText(t.perfil.terminarSessoesFalhou),
        ).toBeDefined();
    });
});
