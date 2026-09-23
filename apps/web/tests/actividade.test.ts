import { describe, expect, it } from 'vitest';

import {
    alturaDaBarra,
    tectoDaTira,
    tiraDeHoras,
} from '../src/servers/actividade.js';
import type { PontoDeActividade } from '../src/servers/server.api.js';

/**
 * O eixo do tempo da tira.
 *
 * A API devolve as horas que existem, e não as que faltam. Sem
 * construir o eixo, duas horas separadas por um dia inteiro apareciam
 * lado a lado — e a tira mentia sobre o tempo com ar de gráfico.
 */
const ponto = (hora: string, peak: number): PontoDeActividade => ({
    hour: hora,
    samples: 10,
    average: peak,
    peak,
    last: peak,
});

const AGORA = new Date('2026-09-23T14:20:00.000Z');

describe('a tira de horas', () => {
    it('tem tantas casas quantas se pedirem', () => {
        expect(tiraDeHoras([], 48, AGORA)).toHaveLength(48);
    });

    it('acaba na hora de agora, cortada à hora', () => {
        const tira = tiraDeHoras([], 3, AGORA);

        expect(tira[2]?.hora.toISOString()).toBe('2026-09-23T14:00:00.000Z');
        expect(tira[1]?.hora.toISOString()).toBe('2026-09-23T13:00:00.000Z');
        expect(tira[0]?.hora.toISOString()).toBe('2026-09-23T12:00:00.000Z');
    });

    it('põe cada ponto na sua casa', () => {
        const tira = tiraDeHoras(
            [ponto('2026-09-23T13:00:00.000Z', 30)],
            3,
            AGORA,
        );

        expect(tira[1]?.ponto?.peak).toBe(30);
    });

    /**
     * O buraco é a razão de isto existir. Uma hora sem dados fica vazia
     * e continua a ocupar o seu lugar no eixo.
     */
    it('deixa vazias as horas sem dados, sem as encolher do eixo', () => {
        const tira = tiraDeHoras(
            [
                ponto('2026-09-23T12:00:00.000Z', 10),
                ponto('2026-09-23T14:00:00.000Z', 20),
            ],
            3,
            AGORA,
        );

        expect(tira[0]?.ponto?.peak).toBe(10);
        expect(tira[1]?.ponto).toBeNull();
        expect(tira[2]?.ponto?.peak).toBe(20);
    });

    /** Uma hora fora da janela não entra, mesmo vindo na resposta. */
    it('ignora o que é mais antigo do que a janela', () => {
        const tira = tiraDeHoras(
            [ponto('2026-09-20T09:00:00.000Z', 99)],
            3,
            AGORA,
        );

        expect(tira.every((casa) => casa.ponto === null)).toBe(true);
    });

    it('não se engasga com uma data que não é uma data', () => {
        const tira = tiraDeHoras([ponto('nem uma data', 5)], 3, AGORA);

        expect(tira.every((casa) => casa.ponto === null)).toBe(true);
    });
});

describe('a altura de uma barra', () => {
    const casaCom = (peak: number) => ({
        hora: AGORA,
        ponto: ponto('2026-09-23T14:00:00.000Z', peak),
    });

    it('é a fração do pico da própria tira', () => {
        expect(alturaDaBarra(casaCom(15), 30)).toBe(50);
        expect(alturaDaBarra(casaCom(30), 30)).toBe(100);
    });

    /**
     * Zero pessoas e hora nenhuma são coisas diferentes, e o gráfico
     * tem de as desenhar diferentes: a primeira é o servidor vazio, a
     * segunda é o servidor desligado.
     */
    it('distingue o servidor vazio do servidor sem dados', () => {
        expect(alturaDaBarra(casaCom(0), 30)).toBe(0);
        expect(alturaDaBarra({ hora: AGORA, ponto: null }, 30)).toBeNull();
    });

    /**
     * Um servidor de cinco pessoas tem direito a um gráfico com forma,
     * e não a uma linha rente ao chão porque outro tem quinhentas.
     */
    it('dá escala ao que a tira tem, e não a um número fixo', () => {
        const pequeno = tiraDeHoras(
            [
                ponto('2026-09-23T13:00:00.000Z', 2),
                ponto('2026-09-23T14:00:00.000Z', 5),
            ],
            2,
            AGORA,
        );

        expect(tectoDaTira(pequeno)).toBe(5);
        expect(alturaDaBarra(pequeno[1] as never, tectoDaTira(pequeno))).toBe(100);
    });

    it('não divide por zero numa tira sem ninguém', () => {
        expect(alturaDaBarra(casaCom(0), 0)).toBe(0);
    });

    it('o tecto de uma tira vazia é zero', () => {
        expect(tectoDaTira(tiraDeHoras([], 5, AGORA))).toBe(0);
    });
});
