import { describe, expect, it } from 'vitest';

import {
    DEGRAUS_DE_EVENTOS,
    DEGRAUS_DE_NIVEL_DE_CREW,
    DEGRAUS_DE_PAGAMENTOS,
    DEGRAUS_DE_PRESENCAS,
    conquistaDeEventos,
    conquistaDeNivel,
    conquistaDePagamentos,
    conquistaDePresencas,
    degrausAlcancados,
} from '@vicehub/database';

/**
 * O catálogo das conquistas.
 *
 * Estava sem testes, e a peça que mais precisava de um é a que decide
 * que degraus uma contagem alcança: ela devolve **todos** os que a
 * contagem já passou, e não só o exato — e essa diferença só se nota
 * num caso que ninguém procura de propósito.
 */
describe('que degraus uma contagem alcança', () => {
    /**
     * O caso que justifica a função ser escrita assim.
     *
     * Uma crew pode concluir o seu décimo evento sem nunca ter passado
     * por aqui aos nove: as conquistas foram acrescentadas depois de
     * ela já existir, ou uma correção de dados mexeu na contagem. Se só
     * o degrau exato fosse dado, ficava um buraco no perfil que ninguém
     * conseguia explicar nem preencher.
     */
    it('dá todos os degraus já passados, e não só o exato', () => {
        expect(degrausAlcancados([1, 10, 50], 10)).toEqual([1, 10]);
    });

    it('dá também os que ficaram para trás quando a contagem salta', () => {
        expect(degrausAlcancados([1, 10, 50], 63)).toEqual([1, 10, 50]);
    });

    it('não dá nada a quem ainda não chegou ao primeiro', () => {
        expect(degrausAlcancados([1, 10, 50], 0)).toEqual([]);
    });

    /** O degrau conta-se a partir de igual, e não de maior. */
    it('dá o degrau a quem lá chegou exatamente', () => {
        expect(degrausAlcancados([5, 10, 25], 5)).toEqual([5]);
    });

    it('não dá o seguinte a quem lhe falta um', () => {
        expect(degrausAlcancados([5, 10, 25], 9)).toEqual([5]);
    });
});

/**
 * Os identificadores são o que fica gravado na base de dados e o que os
 * dicionários traduzem. Mudá-los sem mais nada deixava as conquistas já
 * ganhas sem nome no ecrã.
 */
describe('os identificadores das conquistas', () => {
    it.each([
        [conquistaDePresencas(10), 'attended_10'],
        [conquistaDeEventos(50), 'ran_50'],
        [conquistaDePagamentos(1), 'paid_1'],
        [conquistaDeNivel(25), 'level_25'],
    ])('%s', (obtido, esperado) => {
        expect(obtido).toBe(esperado);
    });
});

/**
 * Os degraus são dados, e não código: acrescentar um é acrescentar um
 * número. O que este teste guarda é a única propriedade de que o resto
 * depende — estarem por ordem crescente, que é o que faz a lista de
 * alcançados sair também ordenada.
 */
describe('as listas de degraus', () => {
    it.each([
        ['presenças', DEGRAUS_DE_PRESENCAS],
        ['eventos', DEGRAUS_DE_EVENTOS],
        ['pagamentos', DEGRAUS_DE_PAGAMENTOS],
        ['níveis de crew', DEGRAUS_DE_NIVEL_DE_CREW],
    ])('os degraus de %s estão por ordem crescente', (_nome, degraus) => {
        expect([...degraus]).toEqual([...degraus].sort((a, b) => a - b));
    });

    it.each([
        ['presenças', DEGRAUS_DE_PRESENCAS],
        ['eventos', DEGRAUS_DE_EVENTOS],
        ['pagamentos', DEGRAUS_DE_PAGAMENTOS],
        ['níveis de crew', DEGRAUS_DE_NIVEL_DE_CREW],
    ])('os degraus de %s não se repetem', (_nome, degraus) => {
        expect(new Set(degraus).size).toBe(degraus.length);
    });
});
