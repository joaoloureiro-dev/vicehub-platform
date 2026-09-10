/**
 * As conquistas, e de onde saem.
 *
 * Todas nascem de factos que a plataforma **já regista**: uma conquista
 * de presenças conta linhas de `XpAward`, que por sua vez só existem
 * porque alguém confirmou que a pessoa apareceu a um evento que chegou
 * ao fim. Nenhuma é atribuída à mão, e nenhuma depende de um número que
 * alguém escreveu num campo.
 *
 * É o que as torna difíceis de falsificar, e é a razão de existirem:
 * um perfil que diz "50 eventos" e não o consegue provar não vale nada
 * a quem está a decidir se aceita essa pessoa na crew.
 */

/**
 * Os degraus, como dados e não como código.
 *
 * Acrescentar um degrau é acrescentar um número a esta lista — não é
 * escrever outro caminho que decide quando se ganha o quê. Foi feito
 * assim porque a tentação de "só mais uma conquista especial" é
 * permanente, e é assim que catálogos destes acabam com quinze regras
 * diferentes que ninguém consegue ler.
 */
export const DEGRAUS_DE_PRESENCAS = [1, 10, 50] as const;
export const DEGRAUS_DE_EVENTOS = [1, 10, 50] as const;

/** O identificador de uma conquista de quem apareceu a eventos. */
export const conquistaDePresencas = (degrau: number): string =>
    `attended_${degrau}`;

/** O identificador de uma conquista de uma crew que correu eventos. */
export const conquistaDeEventos = (degrau: number): string => `ran_${degrau}`;

/**
 * Os degraus que uma contagem acaba de atingir.
 *
 * Devolve **todos** os que a contagem alcança, e não só o último.
 *
 * Parece exagero e não é: uma crew pode concluir o seu décimo evento sem
 * nunca ter passado por aqui aos nove — porque as conquistas foram
 * acrescentadas depois de a crew já existir, ou porque uma correção de
 * dados mexeu na contagem. Dar só o degrau exato deixava buracos no
 * perfil que ninguém conseguia explicar nem preencher.
 */
export const degrausAlcancados = (
    degraus: readonly number[],
    contagem: number,
): number[] => degraus.filter((degrau) => contagem >= degrau);
