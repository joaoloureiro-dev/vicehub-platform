import { describe, expect, it } from 'vitest';

import {
    splitByWeight,
    splitEqually,
    sumShares,
} from '../../src/modules/treasury/services/split.js';

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

/**
 * Testes à divisão ponderada por cargo.
 *
 * Segue o padrão real das comunidades: no paycheck do QBCore o salário
 * vem do grau, e nos assaltos quem lidera leva mais. O método do maior
 * resto existe porque arredondar cada parte por si nunca fecha a conta.
 */
describe('divisão ponderada', () => {
    const pesos = (...valores: number[]) =>
        valores.map((weight, indice) => ({ userId: `user-${indice + 1}`, weight }));

    it('reparte em proporção aos pesos quando a divisão é exata', () => {
        expect(splitByWeight(600n, pesos(3, 2, 1))).toEqual([
            { userId: 'user-1', amount: 300n },
            { userId: 'user-2', amount: 200n },
            { userId: 'user-3', amount: 100n },
        ]);
    });

    /**
     * A propriedade que interessa, e a razão de ser do método do maior
     * resto: arredondar cada parte por si daria 99 ou 102 num total de
     * 100 por três, nunca 100.
     */
    it.each([
        [100n, [3, 2, 1]],
        [1n, [1, 1, 1]],
        [7n, [5, 3, 2]],
        [1_000n, [3, 3, 3, 3, 3]],
        [999_999_999_999n, [7, 11, 13]],
        [10n, [1, 1, 1, 1, 1, 1, 1]],
        [12_345_678n, [3, 2, 2, 1, 1, 1, 1, 1]],
    ])('a soma de %s com pesos %j dá exatamente o total', (total, valores) => {
        const partes = splitByWeight(total, pesos(...valores));

        expect(sumShares(partes)).toBe(total);
        expect(partes).toHaveLength(valores.length);
    });

    it('quem tem mais peso nunca recebe menos do que quem tem menos', () => {
        const partes = splitByWeight(1_000n, pesos(3, 2, 1));

        const valores = partes.map((parte) => parte.amount);

        expect(valores[0]).toBeGreaterThanOrEqual(valores[1] as bigint);
        expect(valores[1]).toBeGreaterThanOrEqual(valores[2] as bigint);
    });

    it('com pesos todos iguais dá o mesmo que a divisão por partes iguais', () => {
        const ponderada = splitByWeight(100n, pesos(1, 1, 1));
        const igual = splitEqually(100n, ['user-1', 'user-2', 'user-3']);

        expect(ponderada).toEqual(igual);
    });

    /**
     * O caso que o método do maior resto resolve: 100 com pesos 3-2-1 dá
     * 50, 33,33 e 16,66. As partes inteiras somam 99, e a unidade que
     * sobra vai para quem tinha a maior fração por satisfazer.
     */
    it('a unidade que sobra vai para a maior fração por satisfazer', () => {
        const partes = splitByWeight(100n, pesos(3, 2, 1));

        expect(partes).toEqual([
            { userId: 'user-1', amount: 50n },
            { userId: 'user-2', amount: 33n },
            { userId: 'user-3', amount: 17n },
        ]);
        expect(sumShares(partes)).toBe(100n);
    });

    it('peso zero não recebe nada', () => {
        const partes = splitByWeight(100n, pesos(1, 0, 1));

        expect(partes[1]?.amount).toBe(0n);
        expect(sumShares(partes)).toBe(100n);
    });

    /**
     * Sem peso nenhum não há proporção que se calcule. Repartir por igual
     * é a leitura menos surpreendente, e evita deixar o dinheiro preso.
     */
    it('com todos os pesos a zero, reparte por igual', () => {
        const partes = splitByWeight(90n, pesos(0, 0, 0));

        expect(partes.map((parte) => parte.amount)).toEqual([30n, 30n, 30n]);
    });

    it('pesos negativos são tratados como zero', () => {
        const partes = splitByWeight(100n, pesos(-5, 1, 1));

        expect(partes[0]?.amount).toBe(0n);
        expect(sumShares(partes)).toBe(100n);
    });

    it('a mesma entrada dá sempre a mesma divisão', () => {
        const primeira = splitByWeight(1_007n, pesos(3, 2, 2, 1, 1));
        const segunda = splitByWeight(1_007n, pesos(3, 2, 2, 1, 1));

        expect(primeira).toEqual(segunda);
    });

    /**
     * Em caso de empate no resto, decide a ordem de entrada — que quem
     * chama ordena por antiguidade.
     */
    it('empates no resto são desfeitos por antiguidade', () => {
        const partes = splitByWeight(10n, pesos(1, 1, 1));

        expect(partes.map((parte) => parte.amount)).toEqual([4n, 3n, 3n]);
    });

    it('sem membros, não há partes', () => {
        expect(splitByWeight(500n, [])).toEqual([]);
    });

    it('aguenta valores acima do que um número de JavaScript representa', () => {
        const enorme = 9_007_199_254_740_993n;

        expect(sumShares(splitByWeight(enorme, pesos(3, 2, 1)))).toBe(enorme);
    });

    it('um total mais pequeno do que o número de membros não perde nada', () => {
        const partes = splitByWeight(2n, pesos(3, 2, 1));

        expect(sumShares(partes)).toBe(2n);
    });
});
