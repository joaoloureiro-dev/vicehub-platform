import type { PontoDeActividade } from './server.api.js';

/**
 * A tira de horas que o gráfico desenha.
 *
 * A API devolve **as horas que existem**, e não as que faltam: uma hora
 * sem batidas não tem linha. Para um gráfico isso não chega — sem os
 * buracos, duas horas separadas por um dia inteiro apareciam lado a
 * lado e a tira mentia sobre o tempo.
 *
 * Esta função constrói o eixo: tantas horas seguidas quantas se pedirem,
 * a acabar na hora de agora, com os dados encaixados onde existirem.
 */
export interface HoraDaTira {
    /** O início da hora, em UTC. */
    hora: Date;
    /** O que lá há, ou nada — que é diferente de zero pessoas. */
    ponto: PontoDeActividade | null;
}

const UMA_HORA_MS = 60 * 60 * 1000;

/** O início da hora a que um instante pertence, em UTC. */
const inicioDaHora = (instante: Date): Date => {
    const hora = new Date(instante);

    hora.setUTCMinutes(0, 0, 0);

    return hora;
};

export const tiraDeHoras = (
    pontos: readonly PontoDeActividade[],
    quantas: number,
    agora: Date = new Date(),
): HoraDaTira[] => {
    /**
     * Indexado pela hora em milissegundos, e não procurado a cada
     * casa: com cento e sessenta e oito horas e quarenta e oito casas,
     * procurar seria oito mil comparações para desenhar uma tira.
     */
    const porHora = new Map<number, PontoDeActividade>();

    for (const ponto of pontos) {
        const quando = new Date(ponto.hour);

        if (!Number.isNaN(quando.getTime())) {
            porHora.set(inicioDaHora(quando).getTime(), ponto);
        }
    }

    const fim = inicioDaHora(agora).getTime();
    const casas = Math.max(1, Math.trunc(quantas));

    return Array.from({ length: casas }, (_, indice) => {
        const hora = fim - (casas - 1 - indice) * UMA_HORA_MS;

        return { hora: new Date(hora), ponto: porHora.get(hora) ?? null };
    });
};

/**
 * A altura de uma barra, em percentagem do tecto da tira.
 *
 * Uma hora sem dados devolve `null` e não zero: o gráfico tem de as
 * distinguir. Zero pessoas é o servidor vazio; hora nenhuma é o servidor
 * desligado, ou um recurso que ninguém instalou ainda.
 *
 * E o tecto é o pico da própria tira, e não um número fixo: um servidor
 * de cinco pessoas tem direito a um gráfico com forma, em vez de uma
 * linha rente ao chão porque outro servidor qualquer tem quinhentas.
 */
export const alturaDaBarra = (
    casa: HoraDaTira,
    tecto: number,
): number | null => {
    if (casa.ponto === null) {
        return null;
    }

    if (tecto <= 0) {
        return 0;
    }

    return Math.round((casa.ponto.peak / tecto) * 100);
};

/** O pico da tira, que é o que dá escala ao resto. */
export const tectoDaTira = (tira: readonly HoraDaTira[]): number =>
    tira.reduce((maior, casa) => Math.max(maior, casa.ponto?.peak ?? 0), 0);
