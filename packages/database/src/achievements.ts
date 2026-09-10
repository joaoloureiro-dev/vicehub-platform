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

/**
 * Divisões que uma crew aprovou — ou seja, vezes que pagou aos seus.
 *
 * É um facto diferente de correr eventos, e é o que uma crew tem de
 * mais difícil de fingir: correr um evento é marcá-lo e confirmar
 * presenças; pagar é tirar dinheiro da tesouraria e pô-lo nas carteiras
 * de outras pessoas. Quem está a decidir se entra numa crew quer saber
 * as duas coisas, e a segunda mais do que a primeira.
 */
export const DEGRAUS_DE_PAGAMENTOS = [1, 10, 50] as const;

/**
 * Níveis de uma crew. **Só de uma crew, e isso é uma decisão.**
 *
 * Uma pessoa só ganha xp de uma maneira — aparecer a eventos — e sempre
 * ao mesmo ritmo. O nível dela é portanto a contagem de presenças com
 * outro nome, e dar-lhe uma medalha por isso era dar duas medalhas pelo
 * mesmo facto: quem chegasse ao nível 5 ganhava-o exatamente por ter
 * aparecido a quarenta eventos, que já é uma conquista à parte.
 *
 * Numa crew não é assim. O xp de um evento depende de quantas pessoas
 * apareceram, e por isso duas crews com o mesmo número de eventos podem
 * estar em níveis diferentes. Aí o nível diz uma coisa que a contagem
 * não diz: o tamanho do que se corre, e não só a frequência.
 */
export const DEGRAUS_DE_NIVEL_DE_CREW = [5, 10, 25] as const;

/** O identificador de uma conquista de quem apareceu a eventos. */
export const conquistaDePresencas = (degrau: number): string =>
    `attended_${degrau}`;

/** O identificador de uma conquista de uma crew que correu eventos. */
export const conquistaDeEventos = (degrau: number): string => `ran_${degrau}`;

/** O identificador de uma conquista de uma crew que pagou aos seus. */
export const conquistaDePagamentos = (degrau: number): string =>
    `paid_${degrau}`;

/** O identificador de uma conquista de nível. */
export const conquistaDeNivel = (degrau: number): string => `level_${degrau}`;

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
