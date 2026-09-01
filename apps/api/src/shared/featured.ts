/**
 * Quantos lugares de destaque tem o topo de um diretório.
 *
 * Poucos de propósito: o destaque só vale alguma coisa enquanto for
 * escasso, e uma lista inteira de destaques é uma lista sem destaques.
 */
export const FEATURED_SLOTS = 3;

/**
 * De quanto em quanto tempo os lugares rodam.
 */
export const FEATURED_ROTATION_MS = 60 * 60 * 1000;

/**
 * Escolhe quem ocupa os lugares de destaque neste momento.
 *
 * Quem paga não fica em fila de espera atrás de quem pagou primeiro: os
 * lugares rodam por todos os candidatos ao longo do dia. Sem isto, os
 * três primeiros a subscrever ficariam com o topo para sempre e o
 * destaque deixaria de ser o que se vendeu ao quarto.
 *
 * A escolha é determinística dentro de cada intervalo — depende apenas
 * dos candidatos e da hora —, e não de aleatoriedade: dois pedidos
 * seguidos têm de dar a mesma resposta, ou a mesma página vista duas
 * vezes mostrava coisas diferentes sem nada ter mudado.
 *
 * Os candidatos têm de vir por uma ordem estável (o identificador
 * serve); com uma ordem que mude entre pedidos, a rotação passaria a
 * saltar entradas em vez de as percorrer.
 */
export const pickFeatured = <T>(
    candidates: readonly T[],
    at: Date,
    slots: number = FEATURED_SLOTS,
): T[] => {
    if (slots <= 0 || candidates.length === 0) {
        return [];
    }

    if (candidates.length <= slots) {
        return [...candidates];
    }

    const bucket = Math.floor(at.getTime() / FEATURED_ROTATION_MS);

    /**
     * O resto de um número negativo é negativo em JavaScript, e uma data
     * anterior a 1970 daria um índice fora da lista.
     */
    const start =
        (((bucket * slots) % candidates.length) + candidates.length) %
        candidates.length;

    /**
     * A janela dá a volta ao fim da lista para que o número de lugares
     * preenchidos não dependa de onde a rotação calhou parar.
     */
    return Array.from(
        { length: slots },
        (_unused, offset) => candidates[(start + offset) % candidates.length] as T,
    );
};
