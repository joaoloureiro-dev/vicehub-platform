import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    login,
    register,
    requestPasswordReset,
} from '../src/auth/auth.api.js';

/**
 * O cartão do CAPTCHA a sair mesmo do browser.
 *
 * O widget podia desenhar-se, a pessoa podia resolvê-lo, e o cartão
 * podia ficar na memória do ecrã sem nunca entrar no pedido — e o
 * sintoma seria toda a gente a ser recusada à porta de uma instalação
 * com CAPTCHA, sem nada no caminho a dizer porquê.
 *
 * E o contrário também está aqui: numa instalação sem CAPTCHA não há
 * cartão nenhum, e o pedido não deve levar um campo vazio a fingir que
 * há.
 */
const corpoDe = (chamada: unknown): Record<string, unknown> =>
    JSON.parse(
        ((chamada as [string, RequestInit])[1].body as string) ?? '{}',
    ) as Record<string, unknown>;

const responder = (body: unknown) => {
    const chamadas = vi.fn(() =>
        Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(body),
        } as Response),
    );

    vi.stubGlobal('fetch', chamadas);

    return chamadas;
};

const sessao = {
    accessToken: 'token-de-teste',
    user: { id: '1', email: 'a@vicehub.test', username: 'a' },
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('o cartão do CAPTCHA no pedido', () => {
    it.each([
        [
            'entrar',
            () => login('a@vicehub.test', 'uma-password', 'o-cartao'),
            sessao,
        ],
        [
            'registar',
            () => register('a@vicehub.test', 'jogadora', 'uma-password', 'o-cartao'),
            sessao,
        ],
        [
            'recuperar a password',
            () => requestPasswordReset('a@vicehub.test', 'o-cartao'),
            {},
        ],
    ])('%s leva o cartão consigo', async (_nome, pedir, resposta) => {
        const chamadas = responder(resposta);

        await pedir();

        expect(corpoDe(chamadas.mock.calls[0]).captchaToken).toBe('o-cartao');
    });

    it.each([
        ['entrar', () => login('a@vicehub.test', 'uma-password'), sessao],
        [
            'registar',
            () => register('a@vicehub.test', 'jogadora', 'uma-password'),
            sessao,
        ],
        [
            'recuperar a password',
            () => requestPasswordReset('a@vicehub.test'),
            {},
        ],
    ])('%s não leva campo nenhum quando não há cartão', async (_nome, pedir, resposta) => {
        const chamadas = responder(resposta);

        await pedir();

        expect(corpoDe(chamadas.mock.calls[0])).not.toHaveProperty('captchaToken');
    });
});
