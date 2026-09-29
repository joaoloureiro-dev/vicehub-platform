import { describe, expect, it } from 'vitest';

import { confiarNoProxy, problemasDeProducao } from '../../src/config/env.js';

/**
 * As configurações que só fazem mal em produção.
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
        SMTP_URL: 'smtp://user:pass@mail.vicehub.com:587',
        TRUST_PROXY: 'true',
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

    /**
     * Sem SMTP os emails ficam no log. Ninguém confirma a conta, ninguém
     * recupera a palavra-passe, e um link de recuperação escrito no log
     * é uma chave para entrar numa conta ao alcance de quem lê logs.
     */
    it('recusa produção sem forma de enviar email', () => {
        const problemas = problemasDeProducao(
            ambiente({ SMTP_URL: undefined }),
        );

        expect(problemas).toHaveLength(1);
        expect(problemas[0]).toContain('SMTP_URL');
    });

    /**
     * **O limite de pedidos é por endereço, e quem sabe o endereço é o
     * proxy.**
     *
     * Sem dizer se há um à frente, as duas respostas erradas são
     * silenciosas: atrás de um proxy sem confiar nele, a plataforma
     * inteira partilha um balde de cem pedidos por minuto e leva 429 à
     * primeira dúzia de visitas; exposta directamente e a confiar,
     * qualquer pessoa escreve o endereço que quiser e o limite deixa de
     * a apanhar.
     */
    it('recusa produção sem dizer se há um proxy à frente', () => {
        const problemas = problemasDeProducao(
            ambiente({ TRUST_PROXY: undefined }),
        );

        expect(problemas).toHaveLength(1);
        expect(problemas[0]).toContain('TRUST_PROXY');
    });

    it('e deixa passar tanto o sim como o não', () => {
        for (const valor of ['true', 'false', '10.0.0.0/8']) {
            expect(
                problemasDeProducao(ambiente({ TRUST_PROXY: valor })),
            ).toEqual([]);
        }
    });

    it('acusa todos de uma vez, e não só o primeiro', () => {
        expect(
            problemasDeProducao(
                ambiente({
                    AUTH_COOKIE_SECURE: false,
                    APP_PUBLIC_URL: 'http://localhost:5173',
                    SMTP_URL: undefined,
                    TRUST_PROXY: undefined,
                }),
            ),
        ).toHaveLength(4);
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
                        SMTP_URL: undefined,
                        TRUST_PROXY: undefined,
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
                        SMTP_URL: undefined,
                        TRUST_PROXY: undefined,
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

/**
 * De quem é o endereço que o limite de pedidos conta.
 *
 * O que sai daqui vai direito ao `trustProxy` do Fastify, e decide se o
 * balde é de cada pessoa ou da plataforma inteira.
 */
describe('em quem se confia quando o pedido vem por um proxy', () => {
    it('sem nada dito, não se confia em ninguém', () => {
        expect(confiarNoProxy(undefined)).toBe(false);
        expect(confiarNoProxy('')).toBe(false);
        expect(confiarNoProxy('   ')).toBe(false);
    });

    it('e "false" é mesmo não', () => {
        expect(confiarNoProxy('false')).toBe(false);
    });

    it('e "true" é mesmo sim', () => {
        expect(confiarNoProxy('true')).toBe(true);
        expect(confiarNoProxy('  true  ')).toBe(true);
    });

    /**
     * O resto é uma lista de endereços ou de blocos, que o Fastify sabe
     * ler separada por vírgulas. Passa tal e qual: quem a escreveu sabe
     * o que lá pôs.
     */
    it('e uma lista de endereços passa tal e qual', () => {
        expect(confiarNoProxy('10.0.0.0/8,127.0.0.1')).toBe(
            '10.0.0.0/8,127.0.0.1',
        );
    });

    /**
     * **Um número de saltos nunca chega aqui.**
     *
     * É o que se escreve no Express, e o Fastify aceita-o e passa a não
     * confiar em ninguém — "contar saltos não permite validar quem está
     * do outro lado", diz o código dele. O efeito seria o mesmo de não
     * definir nada, e sem ninguém dar por isso, por isso é recusado ao
     * ler o ambiente e não aqui.
     */
    it('e um número não é uma maneira de dizer isto', () => {
        expect(confiarNoProxy('1')).not.toBe(true);
        expect(typeof confiarNoProxy('1')).not.toBe('number');
    });
});
