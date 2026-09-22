import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { prisma as PrismaDaAplicacao } from '@vicehub/database';

/**
 * O CAPTCHA à entrada, com as chaves postas.
 *
 * O widget no browser não protege nada — é código que corre na máquina
 * de quem o quiser contornar, e contorná-lo é não o desenhar. O que
 * protege é a pergunta que o servidor faz ao Cloudflare com um segredo
 * que nunca saiu de lá, e é isso que aqui se verifica.
 *
 * Nenhum destes testes fala com o Cloudflare a sério: a resposta dele é
 * substituída em cada teste, porque o que se quer verificar é a decisão
 * que a plataforma toma a partir dela — incluindo a que ela toma quando
 * não há resposta nenhuma.
 *
 * Ficheiro próprio, e não um `describe` ao lado do outro: a
 * configuração é lida uma vez quando os módulos carregam, e a metade
 * sem CAPTCHA — que é a instalação por omissão — precisa de os ter
 * carregado sem chaves nenhumas.
 */
describe('o CAPTCHA à entrada, configurado', () => {
    let app: FastifyInstance;
    let prisma: typeof PrismaDaAplicacao;

    const marca = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    beforeAll(async () => {
        /**
         * As duas chaves andam juntas: a configuração recusa arrancar
         * com uma só, e é essa a configuração que se quer exercitar.
         */
        vi.stubEnv('TURNSTILE_SITE_KEY', 'publica-de-teste');
        vi.stubEnv('TURNSTILE_SECRET_KEY', 'segredo-de-teste');

        vi.resetModules();

        const [{ buildApp }, database] = await Promise.all([
            import('../../src/app.js'),
            import('@vicehub/database'),
        ]);

        prisma = database.prisma;

        app = buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        vi.unstubAllEnvs();
        vi.resetModules();
        await prisma.$disconnect();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    /** O Cloudflare a responder o que se disser — ou a não responder. */
    const cloudflareDiz = (
        resposta: { success: boolean; 'error-codes'?: string[] } | Error,
    ) => {
        const chamadas = vi.fn((_url: string, _init?: RequestInit) => {
            if (resposta instanceof Error) {
                return Promise.reject(resposta);
            }

            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(resposta),
            } as Response);
        });

        vi.stubGlobal('fetch', chamadas);

        return chamadas;
    };

    const registar = (corpo: Record<string, unknown>) =>
        app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: `cfg${marca}@vicehub.test`,
                username: `cfg${marca}`,
                password: 'Sup3rS3cret!Pass',
                ...corpo,
            },
        });

    it('dá ao ecrã a chave pública', async () => {
        const resposta = await app.inject({
            method: 'GET',
            url: '/api/v1/auth/captcha',
        });

        expect(resposta.statusCode).toBe(200);
        expect(resposta.json().siteKey).toBe('publica-de-teste');
    });

    /**
     * O caso que dá razão de ser a tudo isto: um pedido sem cartão é
     * recusado sem sequer se falar com o Cloudflare.
     */
    it('recusa um registo sem cartão', async () => {
        const chamadas = cloudflareDiz({ success: true });

        const resposta = await registar({ username: `cfga${marca}` });

        expect(resposta.statusCode).toBe(400);
        expect(resposta.json().code).toBe('CAPTCHA_FAILED');
        expect(chamadas).not.toHaveBeenCalled();
    });

    it('recusa um cartão que o Cloudflare não reconhece', async () => {
        cloudflareDiz({ success: false, 'error-codes': ['invalid-input-response'] });

        const resposta = await registar({
            username: `cfgb${marca}`,
            captchaToken: 'um-cartao-falso',
        });

        expect(resposta.statusCode).toBe(400);
        expect(resposta.json().code).toBe('CAPTCHA_FAILED');
    });

    /**
     * E não diz porquê. "Cartão já usado" e "cartão de outro site" são
     * coisas diferentes para quem administra e a mesma para quem entra —
     * dizer a um guião qual delas foi é dizer-lhe o que corrigir.
     */
    it('não conta a quem falhou o que o Cloudflare disse', async () => {
        cloudflareDiz({ success: false, 'error-codes': ['timeout-or-duplicate'] });

        const resposta = await registar({
            username: `cfgc${marca}`,
            captchaToken: 'um-cartao-repetido',
        });

        expect(resposta.body).not.toContain('timeout-or-duplicate');
    });

    it('deixa passar um cartão que o Cloudflare aceita', async () => {
        const chamadas = cloudflareDiz({ success: true });

        const resposta = await registar({ captchaToken: 'um-cartao-bom' });

        expect(resposta.statusCode, resposta.body).toBe(201);
        expect(chamadas).toHaveBeenCalledOnce();
    });

    /**
     * O segredo é o que faz a pergunta valer alguma coisa, e vai no
     * corpo do pedido ao Cloudflare — nunca para o browser.
     */
    it('pergunta ao Cloudflare com o segredo do servidor', async () => {
        const chamadas = cloudflareDiz({ success: true });

        await registar({
            email: `cfgd${marca}@vicehub.test`,
            username: `cfgd${marca}`,
            captchaToken: 'outro-cartao-bom',
        });

        const [endereco, opcoes] = chamadas.mock.calls[0] as [string, RequestInit];

        expect(endereco).toContain('challenges.cloudflare.com');
        expect(String(opcoes.body)).toContain('secret=segredo-de-teste');
        expect(String(opcoes.body)).toContain('response=outro-cartao-bom');
    });

    /**
     * O Cloudflare em baixo **fecha a porta**, e não a abre.
     *
     * Deixar passar transformava cada avaria deles numa janela com o
     * CAPTCHA desligado — e quem quisesse abusar disto não tinha de
     * esperar por ela, bastava provocá-la.
     */
    it('recusa quando o Cloudflare não responde', async () => {
        cloudflareDiz(new Error('sem rede'));

        const resposta = await registar({
            username: `cfge${marca}`,
            captchaToken: 'um-cartao-qualquer',
        });

        expect(resposta.statusCode).toBe(400);
        expect(resposta.json().code).toBe('CAPTCHA_FAILED');
    });

    /**
     * E o login também, que é a porta por onde se gasta a contagem de
     * tentativas falhadas de outra pessoa.
     *
     * Com a password certa, de propósito: o que se verifica é que o
     * pedido é recusado **antes de a conta ser tocada**, e não por ser
     * um pedido mau.
     */
    it('recusa um login sem cartão, mesmo com a password certa', async () => {
        cloudflareDiz({ success: true });

        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: {
                email: `cfg${marca}@vicehub.test`,
                password: 'Sup3rS3cret!Pass',
            },
        });

        expect(resposta.statusCode).toBe(400);
        expect(resposta.json().code).toBe('CAPTCHA_FAILED');
    });

    /** E deixa entrar quem o traga. */
    it('deixa entrar com cartão bom', async () => {
        cloudflareDiz({ success: true });

        const resposta = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: {
                email: `cfg${marca}@vicehub.test`,
                password: 'Sup3rS3cret!Pass',
                captchaToken: 'cartao-do-login',
            },
        });

        expect(resposta.statusCode, resposta.body).toBe(200);
    });
});
