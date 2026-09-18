import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A regra que faz este tema funcionar em papel branco.
 *
 * As cores do logótipo são néon, e néon sobre branco não se lê: o
 * magenta dá 3,30 de contraste e o ciano 1,81 — os dois reprovam. Texto
 * **branco** por cima deles reprova na mesma. O que passa é tinta
 * escura por cima da cor, que é como um letreiro funciona.
 *
 * Daí as duas metades do tema: os néons são **preenchimento**, e existe
 * uma versão funda de cada um para quando a cor tem de ser **texto**.
 *
 * Isto é aritmética, não gosto, e por isso é verificável. Sem o teste, a
 * regra morre no dia em que alguém escrever `color: var(--magenta)` —
 * que parece a coisa óbvia a fazer, e deixa a palavra por ler sem dar
 * erro nenhum.
 */
const CSS = readFileSync(
    path.resolve(import.meta.dirname, '../src/styles/theme.css'),
    'utf8',
);

/** O valor de um token, tal como está declarado no `:root`. */
const token = (nome: string): string => {
    const achado = CSS.match(new RegExp(`--${nome}:\\s*([^;]+);`));

    expect(achado, `o token --${nome} não existe`).not.toBeNull();

    return (achado as RegExpMatchArray)[1]!.trim();
};

const canal = (v: number): number => {
    const s = v / 255;

    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminancia = (hex: string): number => {
    const n = Number.parseInt(hex.slice(1), 16);

    return (
        0.2126 * canal((n >> 16) & 255)
        + 0.7152 * canal((n >> 8) & 255)
        + 0.0722 * canal(n & 255)
    );
};

/** O contraste entre duas cores, pela fórmula das WCAG. */
const contraste = (a: string, b: string): number => {
    const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);

    return (claro! + 0.05) / (escuro! + 0.05);
};

/** O mínimo das WCAG para texto normal. */
const LEGIVEL = 4.5;

describe('as cores do tema', () => {
    const papel = token('ground');

    it('assenta em papel branco', () => {
        expect(papel.toUpperCase()).toBe('#FFFFFF');
    });

    /**
     * As versões fundas existem exatamente para isto. Se uma delas
     * deixar de passar, deixou de servir para o que foi feita.
     */
    it.each(['ink', 'muted', 'faint', 'magenta-ink', 'violet-ink', 'cyan-ink', 'cyan-ink'])(
        '--%s lê-se sobre o papel',
        (nome) => {
            expect(contraste(token(nome), papel)).toBeGreaterThanOrEqual(LEGIVEL);
        },
    );

    it.each(['ok-ink', 'danger-ink', 'sunset-ink'])(
        '--%s lê-se sobre o papel',
        (nome) => {
            expect(contraste(token(nome), papel)).toBeGreaterThanOrEqual(LEGIVEL);
        },
    );

    /**
     * E a tinta que assenta por cima do néon serve para os três, porque
     * é uma só. Um botão que mudasse de cor de letra conforme o fundo
     * daria dois botões em vez de um.
     */
    it.each(['magenta', 'violet', 'cyan', 'ok', 'danger', 'sunset'])(
        'a tinta da marca lê-se por cima de --%s',
        (nome) => {
            expect(contraste(token('on-brand'), token(nome)))
                .toBeGreaterThanOrEqual(LEGIVEL);
        },
    );

    /**
     * O caso que nunca deve voltar: um néon como cor de texto.
     *
     * Percorre a folha inteira, e não só os sítios que conhecemos. É
     * isso que a torna útil daqui a um ano, quando houver ecrãs que hoje
     * não existem.
     */
    it('nunca usa um néon como cor de texto', () => {
        const neons = ['magenta', 'violet', 'cyan', 'ok', 'danger', 'sunset'];

        const infratores = [...CSS.matchAll(/\bcolor:\s*var\(--([a-z-]+)\)/g)]
            .map((achado) => achado[1] as string)
            .filter((usado) => neons.includes(usado));

        expect(
            infratores,
            'um néon como texto sobre branco não se lê: usa a versão -ink',
        ).toEqual([]);
    });

    /**
     * E o degradê tem duas versões pela mesma razão. O que acende é para
     * preencher; o que se lê é o fundo, e é ele que vai recortado nas
     * letras da marca.
     */
    it('recorta nas letras o degradê fundo, e não o que acende', () => {
        const inicio = CSS.indexOf('.brand strong {');

        expect(inicio, 'a regra do nome da marca não existe').toBeGreaterThan(-1);

        const corpo = CSS.slice(inicio, CSS.indexOf('}', inicio));

        expect(corpo).toContain('var(--brand-ink)');
    });
});
