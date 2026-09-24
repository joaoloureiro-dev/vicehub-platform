/**
 * As denúncias, que já não são só do fórum.
 *
 * Uma fila só para a plataforma inteira, e não uma por superfície. Duas
 * filas seriam duas caixas de entrada para o mesmo trabalho — e a
 * segunda ficava por abrir, que é a maneira mais silenciosa de uma
 * plataforma deixar de moderar metade do que nela se escreve.
 */

/**
 * O que se pode denunciar.
 *
 * Esta lista é **a lista das superfícies onde o público escreve**, e é
 * por isso que ela não vive no módulo do fórum nem no do mercado: são
 * os dois a apontar para aqui. Quando aparecer uma terceira — uma
 * conversa entre quem compra e quem vende, por exemplo — é aqui que ela
 * entra, e há um teste nos documentos legais que falha enquanto os
 * termos não a nomearem.
 */
export const ALVOS_DE_DENUNCIA = ['topic', 'reply', 'listing'] as const;

export type AlvoDeDenuncia = (typeof ALVOS_DE_DENUNCIA)[number];

/**
 * A que superfície pertence cada alvo.
 *
 * Duas espécies de alvo do fórum e uma do mercado. É esta função que os
 * termos e a política de privacidade têm de acompanhar: o que lá está
 * escrito é sobre superfícies, e não sobre as tabelas de que elas são
 * feitas.
 */
export const SUPERFICIE_DO_ALVO: Readonly<
    Record<AlvoDeDenuncia, 'forum' | 'market'>
> = {
    topic: 'forum',
    reply: 'forum',
    listing: 'market',
};

/** As superfícies onde qualquer pessoa com conta escreve à vista de todos. */
export const SUPERFICIES_PUBLICAS = [
    ...new Set(ALVOS_DE_DENUNCIA.map((alvo) => SUPERFICIE_DO_ALVO[alvo])),
];
