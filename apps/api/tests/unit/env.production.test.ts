import { describe, expect, it } from 'vitest';

import { problemasDeProducao } from '../../src/config/env.js';

/**
 * As duas configurações que só fazem mal em produção.
 *
 * São perigosas precisamente por terem um valor por omissão que
 * funciona: nada falha, nada avisa, e o estrago só aparece quando alguém
 * a sério tenta usar a plataforma. Recusar arrancar é a única resposta
 * que se dá a tempo.
 */
const ambiente = (overrides: Record<string, unknown> = {}) =>
    ({
        NODE_ENV: 'production',
        AUTH_COOKIE_SECURE: true,
        APP_PUBLIC_URL: 'https://vicehub.com',
        ...overrides,
    }) as Parameters<typeof problemasDeProducao>[0];

describe('a configuração que não serve para produção', () => {
    it('deixa passar uma configuração boa', () => {
        expect(problemasDeProducao(ambiente())).toEqual([]);
    });

    /**
     * Sem a marca `Secure`, o cookie que mantém a sessão aberta viaja
     * também em ligações não cifradas.
     */
    it('recusa um cookie de sessão sem Secure', () => {
        const problemas = problemasDeProducao(
            ambiente({ AUTH_COOKIE_SECURE: false }),
        );

        expect(problemas).toHaveLength(1);
        expect(problemas[0]).toContain('AUTH_COOKIE_SECURE');
    });

    /**
     * O endereço dos emails de recuperação sai do APP_PUBLIC_URL. No
     * valor por omissão, manda toda a gente para o localhost de quem fez
     * o deploy — e o pedido parece ter corrido bem.
     */
    it('recusa links de recuperação a apontar para localhost', () => {
        for (const url of [
            'http://localhost:5173',
            'http://localhost',
            'http://127.0.0.1:8080',
        ]) {
            const problemas = problemasDeProducao(
                ambiente({ APP_PUBLIC_URL: url }),
            );

            expect(problemas).toHaveLength(1);
            expect(problemas[0]).toContain('APP_PUBLIC_URL');
        }
    });

    it('acusa os dois de uma vez, e não só o primeiro', () => {
        expect(
            problemasDeProducao(
                ambiente({
                    AUTH_COOKIE_SECURE: false,
                    APP_PUBLIC_URL: 'http://localhost:5173',
                }),
            ),
        ).toHaveLength(2);
    });

    /**
     * Nada disto se aplica fora de produção: em desenvolvimento não há
     * HTTPS nem domínio, e exigir os dois tornaria o projeto impossível
     * de correr localmente.
     */
    describe('fora de produção, não estorva', () => {
        it('deixa o desenvolvimento em paz', () => {
            expect(
                problemasDeProducao(
                    ambiente({
                        NODE_ENV: 'development',
                        AUTH_COOKIE_SECURE: false,
                        APP_PUBLIC_URL: 'http://localhost:5173',
                    }),
                ),
            ).toEqual([]);
        });

        it('deixa os testes em paz', () => {
            expect(
                problemasDeProducao(
                    ambiente({
                        NODE_ENV: 'test',
                        AUTH_COOKIE_SECURE: false,
                        APP_PUBLIC_URL: 'http://localhost:5173',
                    }),
                ),
            ).toEqual([]);
        });
    });

    /**
     * Um domínio a sério que por acaso contenha "localhost" no caminho
     * não é localhost.
     */
    it('não confunde um domínio verdadeiro com localhost', () => {
        expect(
            problemasDeProducao(
                ambiente({ APP_PUBLIC_URL: 'https://vicehub.com/localhost' }),
            ),
        ).toEqual([]);
    });
});
