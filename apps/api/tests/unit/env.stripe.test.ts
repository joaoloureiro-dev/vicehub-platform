import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * A configuração da cobrança, verificada ao arrancar.
 *
 * Uma configuração meia-feita de cobrança não dá erro nenhum enquanto
 * ninguém compra: dá erro no dia em que alguém decide pagar, que é o
 * pior dia possível para a plataforma parecer avariada. Por isso a
 * verificação é no arranque — o único momento em que alguém está a
 * olhar.
 *
 * O ambiente é lido uma vez, quando o módulo é importado. Para o
 * exercitar, põem-se as variáveis e volta a importar-se.
 */
const CHAVES = {
    STRIPE_SECRET_KEY: 'sk_test_1',
    STRIPE_WEBHOOK_SECRET: 'whsec_1',
    STRIPE_SUCCESS_URL: 'https://vicehub.test/premium?estado=sucesso',
    STRIPE_CANCEL_URL: 'https://vicehub.test/premium',
};

const carregar = async (variaveis: Record<string, string>) => {
    for (const [nome, valor] of Object.entries(variaveis)) {
        vi.stubEnv(nome, valor);
    }

    vi.resetModules();

    return import('../../src/config/env.js');
};

afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
});

describe('a configuração da cobrança', () => {
    it('sem nada, a plataforma arranca e a compra fica fechada', async () => {
        const env = await carregar({});

        expect(env.isStripeConfigured).toBe(false);
        expect(env.stripePriceIds).toEqual({});
    });

    it('com as chaves e um preço, vende esse plano', async () => {
        const env = await carregar({
            ...CHAVES,
            STRIPE_PRICE_PREMIUM: 'price_crew',
        });

        expect(env.isStripeConfigured).toBe(true);
        expect(env.stripePriceIds).toEqual({ premium: 'price_crew' });
    });

    it('lê um preço por plano, e só os que estão postos', async () => {
        const env = await carregar({
            ...CHAVES,
            STRIPE_PRICE_PREMIUM: 'price_crew',
            STRIPE_PRICE_SERVER_BASE: 'price_base',
            STRIPE_PRICE_SERVER_UNLIMITED: 'price_unlimited',
        });

        expect(env.stripePriceIds).toEqual({
            premium: 'price_crew',
            server_base: 'price_base',
            server_unlimited: 'price_unlimited',
        });
    });

    /**
     * Chaves sem preço nenhum são um botão de pagar que não sabe cobrar
     * coisa nenhuma. Falharia na primeira compra, e não no arranque.
     */
    it('recusa arrancar com chaves e nenhum preço', async () => {
        await expect(carregar(CHAVES)).rejects.toThrow(
            /preço nenhum/,
        );
    });

    /**
     * E ao contrário: quem pusesse os preços e se esquecesse das chaves
     * via a lista de preços vazia e a compra fechada, sem nada a dizer
     * porquê.
     */
    it('recusa arrancar com preços e sem chaves', async () => {
        await expect(
            carregar({ STRIPE_PRICE_PREMIUM: 'price_crew' }),
        ).rejects.toThrow(/STRIPE_SECRET_KEY/);
    });

    it('recusa arrancar com meia configuração de chaves', async () => {
        await expect(
            carregar({
                STRIPE_SECRET_KEY: 'sk_test_1',
                STRIPE_PRICE_PREMIUM: 'price_crew',
            }),
        ).rejects.toThrow(/STRIPE_WEBHOOK_SECRET/);
    });
});
