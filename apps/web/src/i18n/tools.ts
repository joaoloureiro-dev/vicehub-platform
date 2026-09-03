/**
 * As ferramentas que cada dicionário recebe.
 *
 * Existem para que as mensagens possam depender do número e do idioma
 * sem que cada uma tenha de saber em que idioma está.
 */
export interface Tools {
    /**
     * Escolhe a forma certa para um número, **segundo as regras do
     * idioma** e não as do inglês.
     *
     * Não é o mesmo em toda a parte: em francês, zero é singular
     * ("0 membre"); em inglês, português e espanhol é plural
     * ("0 members", "0 membros", "0 miembros"). Um `n === 1 ? a : b`
     * escrito à mão acerta em três idiomas e falha no quarto — e falha
     * em silêncio, que é a pior maneira.
     */
    plural: (
        n: number,
        formas: Partial<Record<Intl.LDMLPluralRule, string>>,
    ) => string;

    /** Uma data e hora como se leem neste idioma. */
    quando: (iso: string) => string;

    /** Só a data. */
    data: (iso: string) => string;
}

export const criarTools = (locale: string): Tools => {
    const regras = new Intl.PluralRules(locale);

    return {
        plural: (n, formas) => {
            const categoria = regras.select(n);

            /**
             * `other` existe em todos os idiomas e é o último recurso.
             * Se faltar também, é melhor devolver o número sozinho do
             * que texto vazio: um ecrã com um número solto ainda se
             * percebe, um ecrã em branco não.
             */
            return formas[categoria] ?? formas.other ?? String(n);
        },

        quando: (iso) =>
            new Date(iso).toLocaleString(locale, {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            }),

        data: (iso) => new Date(iso).toLocaleDateString(locale),
    };
};
