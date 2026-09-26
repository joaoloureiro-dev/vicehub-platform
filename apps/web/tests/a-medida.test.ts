import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A medida: quantos caracteres cabem numa linha de texto corrido.
 *
 * Uma passagem pelo produto num portátil mediu as linhas de cada ecrã.
 * Os parágrafos de letra pequena — que é onde mora metade do que há
 * para ler neste produto: o que um cargo decide, o que acontece a quem
 * sai — chegavam aos **137 caracteres por linha**. Acima de uns
 * noventa, o olho perde a linha ao voltar à esquerda e salta uma; quem
 * salta uma linha duas vezes fecha a página.
 *
 * E a regra estava escrita em sete sítios com quatro números
 * diferentes, dois deles a resolver o problema à mão no `.hint` de uma
 * página só — sinal de que já tinha sido visto duas vezes e resolvido
 * onde doía, e não onde se decide.
 */
const CSS = readFileSync(
    path.resolve(import.meta.dirname, '../src/styles/theme.css'),
    'utf8',
);

const regra = (seletor: string): string => {
    const inicio = CSS.indexOf(`${seletor} {`);

    expect(inicio, `regra ${seletor} não existe`).toBeGreaterThan(-1);

    return CSS.slice(inicio, CSS.indexOf('}', inicio));
};

/**
 * As larguras em caracteres que **não** são a medida do texto corrido,
 * e porquê. Escritas à mão de propósito: uma nova sem entrada aqui faz
 * o teste falhar, que é como se obriga quem a acrescenta a decidir se
 * é mesmo outra coisa ou se é a medida outra vez com outro número.
 */
const EXCEÇÕES: Readonly<Record<string, string>> = {
    '.who': 'o email no cabeçalho, que é cortado e não lido',
    '.landing h1': 'um título, que se conta em palavras e não em linhas',
    '.landing-sub': 'a entrada, em corpo grande: menos caracteres para a mesma linha',
    '.legal': 'um documento legal, que se lê de outra maneira e tem a razão escrita ao lado',
};

describe('a medida do texto', () => {
    it('está dita uma vez, e em caracteres', () => {
        expect(/--medida:\s*\d+ch/u.test(CSS)).toBe(true);
    });

    it.each([
        ['.panel > p', 'o texto corrido de uma página'],
        ['.hint', 'a letra pequena, que é metade do que há para ler'],
    ])('%s leva-a', (seletor) => {
        expect(regra(seletor)).toContain('max-width: var(--medida)');
    });

    /**
     * O caso que dá razão ao teste todo: sete sítios, quatro números.
     * Sem isto, o próximo ecrã com linhas compridas resolve-o com um
     * `max-width` seu — e volta a haver cinco.
     */
    it('e mais ninguém inventa a sua', () => {
        const linhas = CSS.split('\n');

        const inventadas = linhas
            .map((linha, indice) => ({ linha, indice }))
            .filter(({ linha }) => /max-width:\s*\d+ch/u.test(linha))
            .map(({ indice }) => {
                let cursor = indice;

                while (cursor > 0 && !linhas[cursor]?.includes('{')) {
                    cursor -= 1;
                }

                return (linhas[cursor] ?? '').replace('{', '').trim();
            })
            .filter((seletor) => !(seletor in EXCEÇÕES));

        expect(inventadas).toEqual([]);
    });
});
