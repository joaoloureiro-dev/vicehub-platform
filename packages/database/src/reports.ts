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
 * Quatro espécies, três superfícies. A lista não vive no módulo do
 * fórum nem no do mercado: são os dois — e agora as conversas — a
 * apontar para aqui.
 */
export const ALVOS_DE_DENUNCIA = [
    'topic',
    'reply',
    'listing',
    'message',
] as const;

export type AlvoDeDenuncia = (typeof ALVOS_DE_DENUNCIA)[number];

/** As superfícies onde se escreve, cada uma com as suas espécies de alvo. */
export const SUPERFICIES = ['forum', 'market', 'messages'] as const;

export type Superficie = (typeof SUPERFICIES)[number];

/**
 * A que superfície pertence cada alvo.
 *
 * É este mapa que os termos e a política de privacidade têm de
 * acompanhar: o que lá está escrito é sobre superfícies, e não sobre as
 * tabelas de que elas são feitas.
 */
export const SUPERFICIE_DO_ALVO: Readonly<Record<AlvoDeDenuncia, Superficie>> =
    {
        topic: 'forum',
        reply: 'forum',
        listing: 'market',
        message: 'messages',
    };

/**
 * Quem lê o que se escreve em cada superfície.
 *
 * **A distinção que interessa.** O fórum e o mercado são públicos: o
 * que lá se escreve é lido por toda a gente, e é por isso que os termos
 * as contam e dizem como são vigiadas. Uma conversa é privada — lida
 * pelas duas pessoas que a têm, e por um moderador só se uma mensagem
 * for denunciada.
 *
 * Juntar as três numa lista só era o erro que esta separação existe
 * para impedir: os termos passariam a dizer que uma conversa privada é
 * um sítio onde toda a gente lê, o que é falso e é exactamente a
 * espécie de frase que este projeto não pode ter.
 */
export const QUEM_LE: Readonly<Record<Superficie, 'todos' | 'as duas pessoas'>> =
    {
        forum: 'todos',
        market: 'todos',
        messages: 'as duas pessoas',
    };

/** As superfícies onde qualquer pessoa com conta escreve à vista de todos. */
export const SUPERFICIES_PUBLICAS: readonly Superficie[] = SUPERFICIES.filter(
    (superficie) => QUEM_LE[superficie] === 'todos',
);

/** E as que só as pessoas envolvidas leem. */
export const SUPERFICIES_PRIVADAS: readonly Superficie[] = SUPERFICIES.filter(
    (superficie) => QUEM_LE[superficie] !== 'todos',
);
