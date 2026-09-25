/**
 * Os avisos.
 *
 * A plataforma passou a ter sítios onde outra pessoa fala contigo, e
 * nenhum deles tinha como te dizer que falou. Sem isto, a conversa do
 * mercado é uma conversa que ninguém sabe que tem.
 */

/**
 * De que espécie é um aviso.
 *
 * Lista fechada, como os alvos de uma denúncia: é dela que o ecrã sabe
 * o que escrever e para onde apontar. Uma espécie nova sem entrada nos
 * dicionários é um erro de compilação, e não um aviso em branco na
 * caixa de alguém.
 */
export const ESPECIES_DE_AVISO = [
    'market_message',
    'forum_reply',
    'market_review',
    'market_review_reply',
] as const;

export type EspecieDeAviso = (typeof ESPECIES_DE_AVISO)[number];

/** Quantos avisos por página. */
export const AVISOS_POR_PAGINA = 30;
