import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { prisma } from '@vicehub/database';
import { buildApp } from '../../src/app.js';

/**
 * A instalação sem CAPTCHA, que é a que vem por omissão.
 *
 * É o caso que mantém verdadeira a promessa da página de privacidade:
 * sem as duas chaves configuradas **nenhum script de terceiros chega ao
 * browser e ninguém fala com o Cloudflare** — nem para perguntar.
 *
 * A outra metade vive em `captcha.configurado.test.ts`, num ficheiro
 * próprio porque a configuração é lida uma vez quando os módulos
 * carregam: tê-las no mesmo ficheiro obrigaria a repor os módulos a meio
 * e a ter duas aplicações de pé ao mesmo tempo.
 */
describe('o CAPTCHA à entrada, sem estar configurado', () => {
    let app: FastifyInstance;

    const marca = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const registar = (corpo: Record<string, unknown>) =>
        app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: `cap${marca}@vicehub.test`,
                username: `cap${marca}`,
                password: 'Sup3rS3cret!Pass',
                ...corpo,
            },
        });

    it('deixa registar sem cartão nenhum', async () => {
        const resposta = await registar({});

        expect(resposta.statusCode, resposta.body).toBe(201);
    });

    it('diz ao ecrã que não há chave', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: '/api/v1/auth/captcha',
        });

        expect(resposta.statusCode).toBe(200);
        expect(resposta.json().siteKey).toBeNull();
    });

    /** E não fala com o Cloudflare — nem para perguntar. */
    it('não faz pedido nenhum para fora', async () => {
        const chamadas = vi.fn();

        vi.stubGlobal('fetch', chamadas);

        const resposta = await registar({
            email: `capb${marca}@vicehub.test`,
            username: `capb${marca}`,
        });

        expect(resposta.statusCode, resposta.body).toBe(201);
        expect(chamadas).not.toHaveBeenCalled();
    });

    /** E a recuperação da password é pedida sem cartão nenhum. */
    it('deixa pedir a recuperação sem cartão', async () => {
        const chamadas = vi.fn();

        vi.stubGlobal('fetch', chamadas);

        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/password-reset',
            payload: { email: `cap${marca}@vicehub.test` },
        });

        expect(resposta.statusCode, resposta.body).toBe(202);
        expect(chamadas).not.toHaveBeenCalled();
    });

    /**
     * Um cartão que chegue a uma instalação sem CAPTCHA não é motivo
     * para recusar ninguém.
     *
     * É o que acontece a quem tenha o formulário aberto quando as chaves
     * são retiradas, e não há nada de errado no pedido: não há com que o
     * confirmar, e confirmar nada é o que esta instalação faz a todos.
     */
    it('não recusa quem traga um cartão a mais', async () => {
        const chamadas = vi.fn();

        vi.stubGlobal('fetch', chamadas);

        const resposta = await registar({
            email: `capc${marca}@vicehub.test`,
            username: `capc${marca}`,
            captchaToken: 'um-cartao-de-outra-configuracao',
        });

        expect(resposta.statusCode, resposta.body).toBe(201);
        expect(chamadas).not.toHaveBeenCalled();
    });
});
