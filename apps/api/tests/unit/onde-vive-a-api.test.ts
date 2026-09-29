import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Onde vive a API, dito nos dois sítios que têm de saber.
 *
 * O `connect-src` do `vercel.json` é o que deixa o browser falar com
 * ela. O `URL_POR_OMISSAO` do recurso do servidor de jogo é para onde
 * cada servidor instalado reporta que está de pé. São dois ficheiros
 * que ninguém abre ao mesmo tempo, e o segundo é o que mais custa
 * quando está errado: o readme do recurso diz que **por omissão aponta
 * para a instalação pública**, e com um endereço errado isso passa a
 * mentira — quem instalar segue o readme, não recebe resposta nenhuma,
 * e não tem como adivinhar que o que falta é uma linha que o readme diz
 * ser opcional.
 *
 * Foi encontrado assim: o recurso apontava para `vicehub.gg`, e o resto
 * do repositório inteiro para `api.vicehub.com`.
 */
const RAIZ = path.resolve(import.meta.dirname, '../../../..');

/** A origem da API, como o `vercel.json` a nomeia. */
const doVercel = (): string => {
    const config = JSON.parse(
        readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'),
    ) as {
        headers: { headers: { key: string; value: string }[] }[];
    };

    const politica = config.headers
        .flatMap((grupo) => grupo.headers)
        .find((um) => um.key === 'Content-Security-Policy')?.value ?? '';

    const ligar = politica
        .split(';')
        .map((directiva) => directiva.trim())
        .find((directiva) => directiva.startsWith('connect-src'));

    const origem = (ligar ?? '')
        .split(/\s+/u)
        .find((valor) => valor.startsWith('https://'));

    expect(origem, 'o connect-src do vercel.json não nomeia a API').toBeDefined();

    return origem ?? '';
};

/** O endereço para onde o recurso reporta quando ninguém diz outro. */
const doRecurso = (): string => {
    const lua = readFileSync(
        path.join(RAIZ, 'resources/vicehub/server.lua'),
        'utf8',
    );

    const achado = /local URL_POR_OMISSAO = '([^']+)'/u.exec(lua)?.[1];

    expect(achado, 'não encontrei o URL por omissão no server.lua').toBeDefined();

    return achado ?? '';
};

describe('onde vive a API', () => {
    it('o recurso do servidor de jogo aponta para a mesma origem que o browser', () => {
        expect(new URL(doRecurso()).origin).toBe(new URL(doVercel()).origin);
    });

    /**
     * E para a API, não para a raiz. A interface vive no domínio de
     * cima e a API no `api.`: um recurso apontado à interface recebe
     * uma página HTML em resposta a um POST, e escreve no log do
     * servidor um erro que não diz nada a ninguém.
     */
    it('e para o caminho da API, não para a raiz do sítio', () => {
        expect(doRecurso()).toMatch(/\/api\/v1$/u);
    });

    /**
     * O readme do recurso promete isto por escrito. Se a promessa
     * deixar de ser verdade, é esta linha que tem de mudar primeiro.
     */
    it('e o readme do recurso continua a prometer que há omissão', () => {
        const readme = readFileSync(
            path.join(RAIZ, 'resources/vicehub/readme.md'),
            'utf8',
        );

        expect(readme).toMatch(/By default it points at the public installation/u);
    });
});
