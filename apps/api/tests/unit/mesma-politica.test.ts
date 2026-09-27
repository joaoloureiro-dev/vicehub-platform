import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * A mesma política, servida de dois sítios.
 *
 * A interface pode ser servida pela própria API — e então a política de
 * conteúdo sai do `helmet`, onde está escrita uma vez — ou por um
 * serviço de estáticos como o Vercel, que não corre código nenhum: ali
 * a política é uma linha de configuração, escrita à mão.
 *
 * São dois sítios a dizer a mesma coisa, que é exactamente o género de
 * diferença que ninguém se lembra de ter decidido. Uma política que
 * diverge não se nota a olho: a página abre à mesma, e o que deixa de
 * ser bloqueado só se descobre quando alguém abusa disso.
 *
 * Por isso este teste lê as duas e compara-as directiva a directiva.
 */
const RAIZ = path.resolve(import.meta.dirname, '../../../..');

/** A política do `vercel.json`, partida em directivas. */
const doVercel = (): Map<string, string[]> => {
    const config = JSON.parse(
        readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'),
    ) as {
        headers: { source: string; headers: { key: string; value: string }[] }[];
    };

    const cabecalho = config.headers
        .flatMap((grupo) => grupo.headers)
        .find((um) => um.key === 'Content-Security-Policy');

    expect(cabecalho, 'o vercel.json não serve política de conteúdo').toBeDefined();

    return new Map(
        (cabecalho?.value ?? '').split(';').map((directiva) => {
            const [nome, ...valores] = directiva.trim().split(/\s+/u);

            return [nome ?? '', valores];
        }),
    );
};

/** E a da API, para as páginas que ela própria serve. */
const daApi = async (): Promise<Map<string, string[]>> => {
    vi.resetModules();

    process.env['WEB_DIST_PATH'] = '/qualquer/coisa';
    process.env['TURNSTILE_SITE_KEY'] = '0x0000000000000000000000';
    process.env['TURNSTILE_SECRET_KEY'] = '0x00000000000000000000000000000000';

    const { politicaDeConteudo } = await import(
        '../../src/plugins/http/security.plugin.js'
    );

    /** O helmet escreve `scriptSrc` como `script-src`. */
    const emTraços = (nome: string) =>
        nome.replace(/[A-Z]/gu, (letra) => `-${letra.toLowerCase()}`);

    return new Map(
        Object.entries(politicaDeConteudo()).map(([nome, valores]) => [
            emTraços(nome),
            valores,
        ]),
    );
};

afterEach(() => {
    delete process.env['WEB_DIST_PATH'];
    delete process.env['TURNSTILE_SITE_KEY'];
    delete process.env['TURNSTILE_SECRET_KEY'];
    vi.resetModules();
});

describe('a política de conteúdo dos dois sítios', () => {
    it('cobre as mesmas directivas', async () => {
        const vercel = doVercel();
        const api = await daApi();

        expect([...api.keys()].sort()).toEqual([...vercel.keys()].sort());
    });

    /**
     * O `connect-src` é a única que tem de divergir, e por uma razão
     * concreta: servida pela API, a API é a própria origem; servida pelo
     * Vercel, a API está noutro domínio e tem de ser nomeada. O que este
     * teste guarda é que ela **nomeia alguma coisa** — apagá-la deixava
     * a aplicação sem poder falar com a API, e a página abria na mesma.
     */
    it('e dizem o mesmo em todas menos numa', async () => {
        const vercel = doVercel();
        const api = await daApi();

        for (const [directiva, valores] of api) {
            if (directiva === 'connect-src') {
                continue;
            }

            expect(
                vercel.get(directiva),
                `${directiva} não diz o mesmo nos dois sítios`,
            ).toEqual(valores);
        }
    });

    it('e a que diverge nomeia onde a API vive', () => {
        const ligar = doVercel().get('connect-src') ?? [];

        expect(ligar).toContain("'self'");
        expect(
            ligar.some((origem) => origem.startsWith('https://')),
            'o connect-src do vercel.json não nomeia a API',
        ).toBe(true);
    });
});
