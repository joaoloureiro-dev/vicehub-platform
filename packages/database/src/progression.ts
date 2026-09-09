/**
 * Como uma crew e um jogador sobem de nível.
 *
 * Vive aqui, e não espalhado pelo código, pela mesma razão do catálogo
 * de cargos, do de planos e dos pesos das divisões: quanto vale o quê é
 * uma regra de negócio, e uma regra de negócio tem um sítio só. Quem
 * quiser mudar a curva muda-a aqui e mais nada.
 */

/**
 * O que custa passar de um nível ao seguinte.
 *
 * Cada nível custa mais 100 do que o anterior — o segundo custa 100, o
 * terceiro 200, o quarto 300. Uma curva linear no incremento e
 * quadrática no acumulado: os primeiros níveis chegam depressa, que é o
 * que faz alguém perceber que o sistema existe, e os últimos custam sem
 * serem inalcançáveis.
 */
export const XP_POR_NIVEL = 100;

/**
 * Onde a contagem pára.
 *
 * Não é uma opinião sobre o topo: é o que impede uma conta com xp
 * absurdo — uma migração mal feita, uma soma errada — de pôr um ciclo a
 * andar para sempre à procura do nível.
 */
export const NIVEL_MAXIMO = 100;

/**
 * O xp acumulado que um nível exige.
 *
 * Nível 1 é zero: começa-se lá, e não se ganha nada por existir.
 */
export const xpDoNivel = (nivel: number): bigint => {
    const limitado = Math.min(Math.max(Math.trunc(nivel), 1), NIVEL_MAXIMO);

    return (
        (BigInt(XP_POR_NIVEL) * BigInt(limitado) * BigInt(limitado - 1)) / 2n
    );
};

/**
 * O nível de quem tem este xp.
 *
 * Contado por soma, e não por raiz quadrada: o xp é BigInt porque a
 * moeda do jogo também é, e converter para vírgula flutuante para
 * inverter a fórmula perderia precisão exatamente onde ela decide entre
 * dois níveis.
 */
export const nivelDoXp = (xp: bigint): number => {
    if (xp <= 0n) {
        return 1;
    }

    let nivel = 1;

    while (nivel < NIVEL_MAXIMO && xpDoNivel(nivel + 1) <= xp) {
        nivel += 1;
    }

    return nivel;
};

export interface Progresso {
    nivel: number;

    /** O xp com que se entrou neste nível. */
    xpDoNivelAtual: bigint;

    /** O que o nível seguinte exige, ou null no topo. */
    xpDoNivelSeguinte: bigint | null;

    /** Quanto falta para o seguinte, ou null no topo. */
    xpEmFalta: bigint | null;
}

/**
 * Onde se está dentro do nível.
 *
 * É isto que o ecrã mostra: dizer "nível 3" sem dizer quanto falta para
 * o 4 é dizer a alguém onde está sem lhe dizer para onde vai.
 */
export const progressoDeNivel = (xp: bigint): Progresso => {
    const nivel = nivelDoXp(xp);
    const atual = xpDoNivel(nivel);

    if (nivel >= NIVEL_MAXIMO) {
        return {
            nivel,
            xpDoNivelAtual: atual,
            xpDoNivelSeguinte: null,
            xpEmFalta: null,
        };
    }

    const seguinte = xpDoNivel(nivel + 1);

    return {
        nivel,
        xpDoNivelAtual: atual,
        xpDoNivelSeguinte: seguinte,
        xpEmFalta: seguinte - xp,
    };
};

/* ------------------------------------------------------------------ */
/* De onde vem o xp                                                     */
/* ------------------------------------------------------------------ */

/**
 * O mínimo de presenças confirmadas para um evento valer alguma coisa.
 *
 * Um evento a que só apareceu quem o marcou não é uma conquista da
 * crew — é um formulário preenchido. Duas pessoas não impedem quem
 * esteja mesmo decidido a inflacionar-se com uma segunda conta; impedem
 * que subir de nível sozinho seja o caminho mais fácil, que é o que
 * acontecia sem esta linha.
 */
export const PRESENCAS_MINIMAS = 2;

/** O que um evento vale à crew, antes de contar quem apareceu. */
export const XP_BASE_DO_EVENTO = 50;

/** O que cada presença confirmada acrescenta ao xp da crew. */
export const XP_POR_PRESENCA = 25;

/**
 * O teto de presenças que contam.
 *
 * Um evento com duzentas pessoas é um bom evento, não é oitenta eventos
 * bons. Sem teto, um único servidor cheio deixava toda a gente para
 * trás de uma vez.
 */
export const PRESENCAS_QUE_CONTAM = 20;

/** O que quem apareceu ganha para si, por evento. */
export const XP_DE_QUEM_APARECEU = 25;

/**
 * O xp que um evento concluído dá à crew ou ao servidor que o marcou.
 *
 * Sai da presença confirmada, e não da inscrição: inscrever-se é dizer
 * que se tenciona ir, e o que a plataforma existe para provar é quem
 * apareceu.
 */
export const xpDeUmEvento = (presencasConfirmadas: number): number => {
    if (presencasConfirmadas < PRESENCAS_MINIMAS) {
        return 0;
    }

    const contadas = Math.min(presencasConfirmadas, PRESENCAS_QUE_CONTAM);

    return XP_BASE_DO_EVENTO + XP_POR_PRESENCA * contadas;
};
