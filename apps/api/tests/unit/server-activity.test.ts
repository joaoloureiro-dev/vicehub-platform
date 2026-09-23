import { describe, expect, it } from 'vitest';

import {
    HORAS_GUARDADAS,
    horasDaJanela,
    inicioDaHora,
    limiteDeHorasGuardadas,
    mediaDe,
} from '@vicehub/database';

/**
 * O passado de um servidor, hora a hora.
 *
 * Duas contas decidem tudo o que daqui sai, e as duas mentem com ar de
 * número quando estão erradas: a hora a que uma batida pertence, e a
 * média de um conjunto de horas.
 */
describe('o balde de uma hora', () => {
    it('corta a hora em UTC, e não no fuso de quem corre isto', () => {
        const hora = inicioDaHora(new Date('2026-09-23T14:37:52.431Z'));

        expect(hora.toISOString()).toBe('2026-09-23T14:00:00.000Z');
    });

    /**
     * O balde é partilhado por toda a gente que olha para o mesmo
     * servidor. Cortado pelo relógio de quem escreve, a mesma batida
     * caía em horas diferentes conforme a máquina que a recebesse.
     */
    it('põe no mesmo balde duas batidas da mesma hora', () => {
        const primeira = inicioDaHora(new Date('2026-09-23T14:00:01.000Z'));
        const ultima = inicioDaHora(new Date('2026-09-23T14:59:59.999Z'));

        expect(primeira.getTime()).toBe(ultima.getTime());
    });

    it('separa a batida do minuto seguinte', () => {
        const antes = inicioDaHora(new Date('2026-09-23T14:59:59.999Z'));
        const depois = inicioDaHora(new Date('2026-09-23T15:00:00.000Z'));

        expect(depois.getTime() - antes.getTime()).toBe(60 * 60 * 1000);
    });

    /**
     * O balde é **partilhado**, e por isso é cortado em UTC.
     *
     * Num fuso de hora inteira, cortar no relógio local dá exactamente o
     * mesmo instante — e é por isso que este teste precisa de um fuso de
     * meia hora. A Índia está a cinco horas e meia de UTC: lá, cortar no
     * relógio local põe a fronteira da hora aos trinta minutos, e a
     * mesma batida cai em baldes diferentes conforme a máquina que a
     * receba.
     *
     * Sem isto, a troca de `setUTCMinutes` por `setMinutes` passava a
     * suite inteira nesta máquina, que corre em UTC.
     */
    it('corta em UTC mesmo numa máquina com meia hora de desvio', () => {
        const fusoOriginal = process.env['TZ'];

        try {
            process.env['TZ'] = 'Asia/Kolkata';

            /** Confirma que o fuso pegou — senão o teste não prova nada. */
            expect(new Date('2026-09-23T14:37:00.000Z').getTimezoneOffset())
                .toBe(-330);

            const hora = inicioDaHora(new Date('2026-09-23T14:37:52.431Z'));

            expect(hora.toISOString()).toBe('2026-09-23T14:00:00.000Z');
        } finally {
            if (fusoOriginal === undefined) {
                delete process.env['TZ'];
            } else {
                process.env['TZ'] = fusoOriginal;
            }
        }
    });

    it('não mexe no instante que lhe deram', () => {
        const instante = new Date('2026-09-23T14:37:52.431Z');

        inicioDaHora(instante);

        expect(instante.toISOString()).toBe('2026-09-23T14:37:52.431Z');
    });
});

describe('a média de uma janela', () => {
    /**
     * **Médias não se somam.** É a razão de se guardar a soma e as
     * amostras em vez da média feita: uma hora com sessenta batidas e
     * outra com uma não valem metade cada.
     */
    it('pesa cada hora pelas batidas que teve', () => {
        const cheia = { samples: 60, players_sum: 6_000 };
        const quase_vazia = { samples: 1, players_sum: 0 };

        expect(mediaDe([cheia, quase_vazia])).toBe(98);

        /** A média das médias daria 50, e seria falso. */
        expect(mediaDe([cheia, quase_vazia])).not.toBe(50);
    });

    it('dá zero sem amostras nenhumas, e não divide por zero', () => {
        expect(mediaDe([])).toBe(0);
        expect(mediaDe([{ samples: 0, players_sum: 0 }])).toBe(0);
    });

    it('de uma hora só é a média dessa hora', () => {
        expect(mediaDe([{ samples: 4, players_sum: 42 }])).toBe(11);
    });
});

describe('a janela que se pede', () => {
    it('conta vinte e quatro horas por dia', () => {
        expect(horasDaJanela(7)).toBe(168);
    });

    /**
     * Quem pedir mais do que se guarda recebe o que há, em vez de uma
     * lista vazia ou de um erro sobre um número que não tinha como
     * adivinhar.
     */
    it('não passa da retenção', () => {
        expect(horasDaJanela(3_650)).toBe(HORAS_GUARDADAS);
    });

    it('nunca devolve menos do que um dia', () => {
        expect(horasDaJanela(0)).toBe(24);
        expect(horasDaJanela(-5)).toBe(24);
    });
});

describe('o limite da retenção', () => {
    it('está exatamente a retenção atrás do início desta hora', () => {
        const agora = new Date('2026-09-23T14:37:00.000Z');
        const limite = limiteDeHorasGuardadas(agora);

        expect(inicioDaHora(agora).getTime() - limite.getTime()).toBe(
            HORAS_GUARDADAS * 60 * 60 * 1000,
        );
    });

    /** Noventa dias: uma estação inteira, e não um ano de linhas por ler. */
    it('guarda noventa dias', () => {
        expect(HORAS_GUARDADAS).toBe(90 * 24);
    });
});
