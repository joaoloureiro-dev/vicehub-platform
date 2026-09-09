import { describe, expect, it } from 'vitest';

import {
    NIVEL_MAXIMO,
    PRESENCAS_MINIMAS,
    PRESENCAS_QUE_CONTAM,
    XP_BASE_DO_EVENTO,
    XP_POR_PRESENCA,
    nivelDoXp,
    progressoDeNivel,
    xpDeUmEvento,
    xpDoNivel,
} from '@vicehub/database';

/**
 * A curva de níveis e o que um evento vale.
 *
 * São números, e números errados numa curva não partem nada: continuam
 * a devolver um nível, apenas o errado. É por isso que o que aqui se
 * verifica não é "chama a função" — é a forma da curva, a fronteira
 * exata de cada nível, e a volta completa entre as duas funções.
 */
describe('progressão', () => {
    describe('o que cada nível custa', () => {
        it.each([
            [1, 0n],
            [2, 100n],
            [3, 300n],
            [4, 600n],
            [5, 1_000n],
            [10, 4_500n],
        ])('o nível %i exige %s de xp acumulado', (nivel, esperado) => {
            expect(xpDoNivel(nivel)).toBe(esperado);
        });

        /** Começa-se no 1, e não se ganha nada por existir. */
        it('não dá nível abaixo do primeiro', () => {
            expect(xpDoNivel(0)).toBe(0n);
            expect(xpDoNivel(-5)).toBe(0n);
        });

        it('cada nível custa mais do que o anterior', () => {
            for (let nivel = 2; nivel < 30; nivel += 1) {
                const este = xpDoNivel(nivel) - xpDoNivel(nivel - 1);
                const seguinte = xpDoNivel(nivel + 1) - xpDoNivel(nivel);

                expect(seguinte).toBeGreaterThan(este);
            }
        });
    });

    describe('o nível de quem tem este xp', () => {
        it('começa no primeiro', () => {
            expect(nivelDoXp(0n)).toBe(1);
            expect(nivelDoXp(-100n)).toBe(1);
        });

        /**
         * A fronteira é o que interessa: um xp abaixo do limiar ainda é
         * o nível anterior, e o limiar exato já é o seguinte.
         */
        it.each([2, 3, 4, 5, 12])('acerta na fronteira do nível %i', (nivel) => {
            const limiar = xpDoNivel(nivel);

            expect(nivelDoXp(limiar - 1n)).toBe(nivel - 1);
            expect(nivelDoXp(limiar)).toBe(nivel);
        });

        it('dá a volta completa', () => {
            for (let nivel = 1; nivel <= 40; nivel += 1) {
                expect(nivelDoXp(xpDoNivel(nivel))).toBe(nivel);
            }
        });

        /**
         * O teto não é uma opinião sobre o topo: é o que impede um xp
         * absurdo — uma soma errada, uma migração mal feita — de pôr o
         * ciclo a andar para sempre.
         */
        it('pára no topo em vez de contar para sempre', () => {
            expect(nivelDoXp(10n ** 30n)).toBe(NIVEL_MAXIMO);
        });
    });

    describe('onde se está dentro do nível', () => {
        it('diz quanto falta para o seguinte', () => {
            const progresso = progressoDeNivel(150n);

            expect(progresso.nivel).toBe(2);
            expect(progresso.xpDoNivelAtual).toBe(100n);
            expect(progresso.xpDoNivelSeguinte).toBe(300n);
            expect(progresso.xpEmFalta).toBe(150n);
        });

        it('no limiar exato, falta o nível inteiro seguinte', () => {
            const progresso = progressoDeNivel(100n);

            expect(progresso.nivel).toBe(2);
            expect(progresso.xpEmFalta).toBe(200n);
        });

        /** No topo não há seguinte, e dizer que faltam zero seria mentir. */
        it('no topo não promete nível seguinte', () => {
            const progresso = progressoDeNivel(10n ** 12n);

            expect(progresso.nivel).toBe(NIVEL_MAXIMO);
            expect(progresso.xpDoNivelSeguinte).toBeNull();
            expect(progresso.xpEmFalta).toBeNull();
        });
    });

    describe('o que um evento vale', () => {
        /**
         * Um evento a que só apareceu quem o marcou não é uma conquista
         * da crew — é um formulário preenchido.
         */
        it.each([0, 1])('não vale nada com %i presenças', (presencas) => {
            expect(xpDeUmEvento(presencas)).toBe(0);
        });

        it('vale a partir do mínimo de presenças', () => {
            expect(xpDeUmEvento(PRESENCAS_MINIMAS)).toBe(
                XP_BASE_DO_EVENTO + XP_POR_PRESENCA * PRESENCAS_MINIMAS,
            );
        });

        it('cresce com quem apareceu', () => {
            expect(xpDeUmEvento(5)).toBeGreaterThan(xpDeUmEvento(4));
        });

        /**
         * Um evento com duzentas pessoas é um bom evento, não é oitenta
         * eventos bons.
         */
        it('não cresce para lá do teto', () => {
            const noTeto = xpDeUmEvento(PRESENCAS_QUE_CONTAM);

            expect(xpDeUmEvento(PRESENCAS_QUE_CONTAM + 1)).toBe(noTeto);
            expect(xpDeUmEvento(5_000)).toBe(noTeto);
        });
    });
});
