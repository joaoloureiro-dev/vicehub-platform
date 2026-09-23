/**
 * O passado de um servidor, hora a hora.
 *
 * O heartbeat diz quantas pessoas estão lá **agora**. Sozinho, não
 * distingue um servidor cheio todos os dias de um que encheu hoje à
 * tarde — e é precisamente essa diferença que um leaderboard ordena e
 * que um gráfico mostra.
 *
 * As regras vivem aqui, e não no repositório, porque são a parte que
 * pode estar errada: uma hora mal cortada mistura dois baldes, e uma
 * média mal feita mente com ar de número.
 */

/**
 * Quanto tempo se guarda.
 *
 * Noventa dias chegam para uma tendência de estação e para um
 * leaderboard de qualquer janela que valha a pena ordenar. Guardar para
 * sempre era guardar o que ninguém lê: um servidor ocupa vinte e quatro
 * linhas por dia, e um ano de mil servidores são quase nove milhões de
 * linhas para responder a perguntas sobre a semana passada.
 */
export const HORAS_GUARDADAS = 90 * 24;

/**
 * Quantas horas cabem na janela que se pede.
 *
 * Existe para o limite ser um só: quem pedir trezentos dias recebe os
 * noventa que existem, em vez de uma lista vazia ou de um erro sobre um
 * número que ele não tinha como adivinhar.
 */
export const horasDaJanela = (dias: number): number =>
    Math.min(Math.max(Math.trunc(dias), 1) * 24, HORAS_GUARDADAS);

/**
 * O início da hora a que um instante pertence, em UTC.
 *
 * **UTC e não o fuso de quem lê**, de propósito: o balde é partilhado
 * por toda a gente que olha para o mesmo servidor, e cortá-lo pelo
 * relógio de quem escreve punha a mesma batida em horas diferentes
 * conforme a máquina que a recebesse.
 *
 * Quem mostra o gráfico converte para o fuso de quem lê. Guardar já
 * convertido é que não tem volta.
 */
export const inicioDaHora = (instante: Date): Date => {
    const hora = new Date(instante);

    hora.setUTCMinutes(0, 0, 0);

    return hora;
};

export interface BaldeDeHora {
    samples: number;
    players_sum: number;
}

/**
 * A média de um balde, ou de vários somados.
 *
 * Guarda-se a soma e as amostras em vez da média feita porque **médias
 * não se somam**: a média de um dia não é a média das médias das suas
 * vinte e quatro horas quando umas tiveram mais batidas do que outras.
 * Com estes dois números, a média de qualquer janela sai da mesma conta.
 *
 * Zero amostras dá zero, e não uma divisão por zero: uma hora sem
 * batidas é uma hora sem gente, e é isso que o gráfico deve mostrar.
 */
export const mediaDe = (baldes: readonly BaldeDeHora[]): number => {
    const amostras = baldes.reduce((total, balde) => total + balde.samples, 0);

    if (amostras === 0) {
        return 0;
    }

    const soma = baldes.reduce((total, balde) => total + balde.players_sum, 0);

    return Math.round(soma / amostras);
};

/**
 * O limite a partir do qual uma hora deixa de se guardar.
 *
 * Separado de quem apaga, para o teste poder contar exactamente o mesmo
 * que a eliminação apaga em vez de reescrever a condição ao lado.
 */
export const limiteDeHorasGuardadas = (agora: Date = new Date()): Date =>
    new Date(inicioDaHora(agora).getTime() - HORAS_GUARDADAS * 60 * 60 * 1000);
