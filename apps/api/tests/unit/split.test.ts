import { describe, expect, it } from 'vitest';

import { splitEqually, sumShares } from '../../src/modules/treasury/services/split.js';

/**
 * Testes ao cálculo de uma divisão.
 *
 * É a parte que decide quanto cada pessoa recebe. Um resto perdido aqui
 * não dá erro nenhum: dá uma tesouraria com dinheiro a mais que ninguém
 * sabe explicar, e a diferença cresce a cada divisão.
 */
describe('divisão em partes iguais', () => {
    const membros = (quantos: number): string[] =>
        Array.from({ length: quantos }, (_, indice) => `user-${indice + 1}`);

    it('divide exatamente quando o total é divisível', () => {
        expect(splitEqually(900n, membros(3))).toEqual([
            { userId: 'user-1', amount: 300n },
            { userId: 'user-2', amount: 300n },
            { userId: 'user-3', amount: 300n },
        ]);
    });

    /**
     * A propriedade que interessa: a soma das partes é sempre igual ao
     * total, seja qual for o resto.
     */
    it.each([
        [100n, 3],
        [1n, 7],
        [7n, 2],
        [1_000_000n, 7],
        [999_999_999_999n, 13],
        [5n, 5],
        [4n, 5],
    ])('a soma das partes de %s por %s pessoas dá exatamente o total', (total, quantos) => {
        const partes = splitEqually(total, membros(quantos));

        expect(sumShares(partes)).toBe(total);
        expect(partes).toHaveLength(quantos);
    });

    it('reparte o resto pelos primeiros da lista', () => {
        expect(splitEqually(100n, membros(3))).toEqual([
            { userId: 'user-1', amount: 34n },
            { userId: 'user-2', amount: 33n },
            { userId: 'user-3', amount: 33n },
        ]);
    });

    /**
     * Ninguém pode receber mais do que uma unidade a mais do que outro:
     * o resto é sempre menor do que o número de pessoas.
     */
    it.each([
        [100n, 3],
        [1n, 7],
        [98n, 11],
        [12_345n, 100],
    ])('em %s por %s, a diferença entre partes nunca passa de uma unidade', (total, quantos) => {
        const valores = splitEqually(total, membros(quantos)).map((parte) => parte.amount);

        const maior = valores.reduce((a, b) => (a > b ? a : b));
        const menor = valores.reduce((a, b) => (a < b ? a : b));

        expect(maior - menor).toBeLessThanOrEqual(1n);
    });

    it('um total mais pequeno do que o número de pessoas deixa alguns a zero', () => {
        const partes = splitEqually(2n, membros(5));

        expect(partes.map((parte) => parte.amount)).toEqual([1n, 1n, 0n, 0n, 0n]);
        expect(sumShares(partes)).toBe(2n);
    });

    it('uma pessoa sozinha recebe tudo', () => {
        expect(splitEqually(777n, ['user-1'])).toEqual([
            { userId: 'user-1', amount: 777n },
        ]);
    });

    it('sem ninguém para receber, não há partes', () => {
        expect(splitEqually(500n, [])).toEqual([]);
    });

    /**
     * Os montantes são BigInt de ponta a ponta. Com números de JavaScript
     * este total perderia precisão e a soma deixaria de fechar.
     */
    it('aguenta valores acima do que um número de JavaScript representa', () => {
        const enorme = 9_007_199_254_740_993n;

        const partes = splitEqually(enorme, membros(3));

        expect(sumShares(partes)).toBe(enorme);
    });

    it('a mesma entrada dá sempre a mesma divisão', () => {
        const primeira = splitEqually(1_000n, membros(7));
        const segunda = splitEqually(1_000n, membros(7));

        expect(primeira).toEqual(segunda);
    });
});
