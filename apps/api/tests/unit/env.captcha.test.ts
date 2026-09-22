import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * As duas chaves do CAPTCHA, verificadas ao arrancar.
 *
 * Meia configuração falha em silêncio nos dois sentidos, e nenhum deles
 * dá erro: só com a pública, o widget aparece e ninguém confirma nada do
 * lado do servidor — teatro; só com a secreta, o servidor exige um
 * cartão que o browser nunca teve como mostrar, e recusa toda a gente à
 * porta sem nada a dizer porquê.
 *
 * Como nos preços, o ambiente é lido uma vez quando o módulo é
 * importado: para o exercitar, põem-se as variáveis e volta a
 * importar-se.
 */
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

describe('a configuração do CAPTCHA', () => {
    /**
     * O caso por omissão, e o que mantém verdadeira a promessa da
     * página de privacidade: sem chaves não há CAPTCHA nenhum e nenhum
     * script de terceiros chega ao browser.
     */
    it('sem nada, arranca e não há CAPTCHA', async () => {
        const env = await carregar({});

        expect(env.env.TURNSTILE_SITE_KEY).toBeUndefined();
        expect(env.env.TURNSTILE_SECRET_KEY).toBeUndefined();
    });

    it('com as duas, fica configurado', async () => {
        const env = await carregar({
            TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
            TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
        });

        expect(env.env.TURNSTILE_SITE_KEY).toBe('1x00000000000000000000AA');
        expect(env.env.TURNSTILE_SECRET_KEY).toBe(
            '1x0000000000000000000000000000000AA',
        );
    });

    /** Só a pública: widget desenhado, e ninguém a confirmar nada. */
    it('recusa arrancar só com a chave pública', async () => {
        await expect(
            carregar({ TURNSTILE_SITE_KEY: '1x00000000000000000000AA' }),
        ).rejects.toThrow(/inválida/);
    });

    /** Só a secreta: porta fechada a toda a gente, sem dizer porquê. */
    it('recusa arrancar só com a chave secreta', async () => {
        await expect(
            carregar({
                TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
            }),
        ).rejects.toThrow(/inválida/);
    });

    /**
     * E o erro diz **qual** falta, que é a única coisa que quem está a
     * configurar precisa de ler.
     */
    it.each([
        ['TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'],
        ['TURNSTILE_SECRET_KEY', 'TURNSTILE_SITE_KEY'],
    ])('com %s posta, aponta a %s em falta', async (posta, emFalta) => {
        const registado: unknown[] = [];

        vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
            registado.push(...args);
        });

        await expect(carregar({ [posta]: 'valor-de-teste' })).rejects.toThrow();

        expect(JSON.stringify(registado)).toContain(emFalta);
    });
});
