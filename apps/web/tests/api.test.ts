import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, api, refreshSession } from '../src/lib/api.js';
import { sessionStore } from '../src/lib/session.js';

const utilizador = { id: 'u1', email: 'player@vicehub.test', username: 'player' };

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const semCorpo = (status: number): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.reject(new Error('sem corpo')),
    }) as Response;

describe('cliente da API', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    const chamadas = () =>
        fetchMock.mock.calls.map((argumentos) => String(argumentos[0]));

    describe('o que segue em cada pedido', () => {
        it('leva o access token no cabeçalho', async () => {
            sessionStore.set('token-de-acesso', utilizador);
            fetchMock.mockResolvedValue(json(200, { ok: true }));

            await api('/users/me');

            const opcoes = fetchMock.mock.calls[0]?.[1] as RequestInit;

            expect((opcoes.headers as Record<string, string>)['authorization']).toBe(
                'Bearer token-de-acesso',
            );
        });

        /**
         * Sem `credentials: 'include'` o cookie do refresh token não sai
         * do browser, e a sessão morre no primeiro F5.
         */
        it('manda sempre os cookies', async () => {
            fetchMock.mockResolvedValue(json(200, {}));

            await api('/users/me');

            const opcoes = fetchMock.mock.calls[0]?.[1] as RequestInit;

            expect(opcoes.credentials).toBe('include');
        });

        it('não inventa um cabeçalho de autorização sem sessão', async () => {
            fetchMock.mockResolvedValue(json(200, {}));

            await api('/users/me');

            const opcoes = fetchMock.mock.calls[0]?.[1] as RequestInit;

            expect(
                (opcoes.headers as Record<string, string>)['authorization'],
            ).toBeUndefined();
        });
    });

    /**
     * A propriedade que mais importa neste ficheiro.
     *
     * O backend roda o refresh token a cada utilização e trata uma
     * segunda utilização como roubo: derruba a sessão inteira. Um ecrã
     * com três pedidos em paralelo e o access token expirado levaria
     * três 401 — e três renovações com o mesmo cookie fariam o próprio
     * utilizador parecer um atacante.
     */
    describe('renovação da sessão', () => {
        it('três pedidos em paralelo renovam a sessão uma só vez', async () => {
            sessionStore.set('expirado', utilizador);

            fetchMock.mockImplementation((url: string) => {
                if (String(url).endsWith('/auth/refresh')) {
                    return Promise.resolve(
                        json(200, { accessToken: 'novo', user: utilizador }),
                    );
                }

                return Promise.resolve(
                    sessionStore.getAccessToken() === 'novo'
                        ? json(200, { ok: true })
                        : json(401, { code: 'INVALID_ACCESS_TOKEN' }),
                );
            });

            await Promise.all([
                api('/crews'),
                api('/servers'),
                api('/users/me'),
            ]);

            const renovacoes = chamadas().filter((url) =>
                url.endsWith('/auth/refresh'),
            );

            expect(renovacoes).toHaveLength(1);
        });

        it('repete o pedido original depois de renovar', async () => {
            sessionStore.set('expirado', utilizador);

            fetchMock
                .mockResolvedValueOnce(json(401, { code: 'INVALID_ACCESS_TOKEN' }))
                .mockResolvedValueOnce(
                    json(200, { accessToken: 'novo', user: utilizador }),
                )
                .mockResolvedValueOnce(json(200, { nome: 'Vice Kings' }));

            await expect(api('/crews/1')).resolves.toEqual({ nome: 'Vice Kings' });

            expect(chamadas()).toEqual([
                '/api/v1/crews/1',
                '/api/v1/auth/refresh',
                '/api/v1/crews/1',
            ]);
        });

        /**
         * Um segundo 401 depois de uma renovação bem sucedida não é uma
         * sessão expirada: é falta de autorização. Repetir outra vez só
         * daria um ciclo.
         */
        it('não repete mais do que uma vez', async () => {
            sessionStore.set('expirado', utilizador);

            fetchMock.mockImplementation((url: string) =>
                Promise.resolve(
                    String(url).endsWith('/auth/refresh')
                        ? json(200, { accessToken: 'novo', user: utilizador })
                        : json(401, { code: 'INVALID_ACCESS_TOKEN' }),
                ),
            );

            await expect(api('/crews')).rejects.toBeInstanceOf(ApiError);

            expect(chamadas().filter((url) => url.endsWith('/crews'))).toHaveLength(
                2,
            );
        });

        /**
         * O próprio refresh não pode disparar outro refresh: seria uma
         * recursão sem fim contra um cookie que já não serve.
         */
        it('o refresh não tenta renovar-se a si próprio', async () => {
            fetchMock.mockResolvedValue(json(401, { code: 'INVALID_REFRESH_TOKEN' }));

            await expect(refreshSession()).rejects.toBeInstanceOf(ApiError);

            expect(chamadas()).toHaveLength(1);
        });

        it('esquece a sessão quando a renovação falha', async () => {
            sessionStore.set('expirado', utilizador);

            fetchMock.mockResolvedValue(json(401, { code: 'INVALID_REFRESH_TOKEN' }));

            await expect(api('/crews')).rejects.toMatchObject({
                code: 'SESSION_EXPIRED',
            });

            expect(sessionStore.getAccessToken()).toBeNull();
            expect(sessionStore.getUser()).toBeNull();
        });

        /**
         * Uma falha de rede não pode deixar cá dentro uma promessa
         * rejeitada, ou todos os pedidos seguintes falhariam por causa
         * dela mesmo depois de a rede voltar.
         */
        it('uma renovação falhada não envenena a seguinte', async () => {
            fetchMock.mockResolvedValueOnce(
                json(401, { code: 'INVALID_REFRESH_TOKEN' }),
            );

            await expect(refreshSession()).rejects.toBeInstanceOf(ApiError);

            fetchMock.mockResolvedValueOnce(
                json(200, { accessToken: 'novo', user: utilizador }),
            );

            await expect(refreshSession()).resolves.toMatchObject({
                accessToken: 'novo',
            });
        });
    });

    describe('erros', () => {
        it('preserva o código de domínio devolvido pela API', async () => {
            fetchMock.mockResolvedValue(
                json(400, { code: 'INVALID_ACCOUNT_TOKEN', message: 'Já não serve.' }),
            );

            const falha = await api('/auth/password-reset/confirm', {
                method: 'POST',
                withoutRefresh: true,
            }).catch((erro: unknown) => erro);

            expect(falha).toBeInstanceOf(ApiError);
            expect((falha as ApiError).code).toBe('INVALID_ACCOUNT_TOKEN');
            expect((falha as ApiError).status).toBe(400);
        });

        it('aguenta uma resposta de erro sem corpo JSON', async () => {
            fetchMock.mockResolvedValue(semCorpo(502));

            const falha = await api('/crews').catch((erro: unknown) => erro);

            expect(falha).toBeInstanceOf(ApiError);
            expect((falha as ApiError).status).toBe(502);
        });

        it('devolve nada num 204 em vez de tentar ler JSON', async () => {
            fetchMock.mockResolvedValue(semCorpo(204));

            await expect(api('/auth/logout', { method: 'POST' })).resolves
                .toBeUndefined();
        });
    });
});
