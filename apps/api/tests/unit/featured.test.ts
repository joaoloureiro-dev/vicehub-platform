import { describe, expect, it } from 'vitest';

import {
    FEATURED_ROTATION_MS,
    pickFeatured,
} from '../../src/shared/featured.js';

/**
 * A rotação dos lugares de destaque.
 *
 * O que se vende é o topo do diretório. Se os lugares não rodassem, os
 * primeiros a subscrever ficavam com eles para sempre e os seguintes
 * pagavam por uma coisa que nunca chegavam a ter.
 */
describe('pickFeatured', () => {
    const inicio = new Date('2026-09-01T00:00:00.000Z');

    const maisTarde = (intervalos: number): Date =>
        new Date(inicio.getTime() + intervalos * FEATURED_ROTATION_MS);

    const candidatos = (quantos: number): string[] =>
        Array.from({ length: quantos }, (_unused, index) => `crew-${index}`);

    it('não devolve nada quando ninguém tem plano', () => {
        expect(pickFeatured([], inicio)).toEqual([]);
    });

    it('devolve todos quando os candidatos não chegam para os lugares', () => {
        expect(pickFeatured(candidatos(2), inicio, 3)).toEqual([
            'crew-0',
            'crew-1',
        ]);
    });

    it('preenche os lugares todos quando há candidatos que cheguem', () => {
        expect(pickFeatured(candidatos(10), inicio, 3)).toHaveLength(3);
    });

    /**
     * Dois pedidos seguidos têm de dar a mesma resposta. Com escolha
     * aleatória, a mesma página vista duas vezes mostrava coisas
     * diferentes sem nada ter mudado.
     */
    it('dá sempre a mesma resposta dentro do mesmo intervalo', () => {
        const lista = candidatos(10);
        const quaseNoFim = new Date(inicio.getTime() + FEATURED_ROTATION_MS - 1);

        expect(pickFeatured(lista, quaseNoFim, 3)).toEqual(
            pickFeatured(lista, inicio, 3),
        );
    });

    it('muda de ocupantes quando o intervalo passa', () => {
        const lista = candidatos(10);

        expect(pickFeatured(lista, maisTarde(1), 3)).not.toEqual(
            pickFeatured(lista, inicio, 3),
        );
    });

    /**
     * A promessa é esta: quem paga chega ao topo. Ao fim de voltas
     * suficientes, nenhum candidato pode ter ficado de fora.
     */
    it('dá a volta a todos os candidatos', () => {
        const lista = candidatos(10);
        const vistos = new Set<string>();

        for (let intervalo = 0; intervalo < 20; intervalo += 1) {
            for (const escolhido of pickFeatured(lista, maisTarde(intervalo), 3)) {
                vistos.add(escolhido);
            }
        }

        expect([...vistos].sort()).toEqual([...lista].sort());
    });

    /**
     * Sem dar a volta ao fim da lista, o número de lugares preenchidos
     * dependia de onde a rotação calhasse parar: às vezes três, às vezes
     * um. O destaque não pode encolher por causa da hora.
     */
    it('preenche os lugares todos mesmo quando a janela passa do fim', () => {
        const lista = candidatos(4);

        for (let intervalo = 0; intervalo < 8; intervalo += 1) {
            expect(pickFeatured(lista, maisTarde(intervalo), 3)).toHaveLength(3);
        }
    });

    it('não repete o mesmo candidato dentro da mesma volta', () => {
        const escolhidos = pickFeatured(candidatos(4), maisTarde(3), 3);

        expect(new Set(escolhidos).size).toBe(escolhidos.length);
    });

    /**
     * O resto de um número negativo é negativo em JavaScript. Uma data
     * anterior a 1970 daria um índice fora da lista e um undefined a
     * passar-se por crew.
     */
    it('aguenta uma data anterior à época do sistema', () => {
        const escolhidos = pickFeatured(
            candidatos(10),
            new Date('1969-01-01T00:00:00.000Z'),
            3,
        );

        expect(escolhidos).toHaveLength(3);
        expect(escolhidos.every((id) => id.startsWith('crew-'))).toBe(true);
    });

    it('não devolve nada quando não há lugares a atribuir', () => {
        expect(pickFeatured(candidatos(10), inicio, 0)).toEqual([]);
    });
});
