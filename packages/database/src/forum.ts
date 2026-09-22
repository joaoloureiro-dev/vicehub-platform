/**
 * O fórum: onde as pessoas perguntam e se respondem umas às outras.
 *
 * É o primeiro sítio da plataforma onde **o público escreve texto que
 * outras pessoas leem**. Quase tudo o que aqui está sai dessa frase.
 */

/** Um título curto de mais não diz a pergunta; um longo de mais é o corpo. */
export const TITULO_MINIMO = 8;
export const TITULO_MAXIMO = 140;

/**
 * O corpo.
 *
 * O mínimo existe para uma pergunta ter o suficiente para alguém a poder
 * responder — "ajuda" não é uma pergunta. O máximo é generoso de
 * propósito: quem descreve um problema a sério precisa de espaço, e um
 * limite apertado empurra as pessoas a escrever pior.
 */
export const CORPO_MINIMO = 12;
export const CORPO_MAXIMO = 8_000;

/** Quantos tópicos por página na lista. */
export const TOPICOS_POR_PAGINA = 20;

/**
 * Quantas respostas se leem de uma vez num tópico.
 *
 * Um tópico com trezentas respostas existe, e mandá-las todas de uma vez
 * castiga o telemóvel de quem só queria ler a pergunta.
 */
export const RESPOSTAS_POR_PAGINA = 50;

/**
 * Prepara texto escrito por uma pessoa para ser guardado.
 *
 * Duas coisas, e só duas:
 *
 * - tira os espaços das pontas, porque ninguém os quis escrever;
 * - corta as quebras de linha seguidas a duas, porque quinze linhas em
 *   branco no meio de uma resposta é a maneira mais barata de ocupar um
 *   ecrã inteiro sem dizer nada.
 *
 * O que **não** faz é tirar marcação, e isso é deliberado. O que a
 * pessoa escreveu fica guardado letra por letra, incluindo os sinais de
 * maior e de menor — alguém a explicar um erro de configuração precisa
 * de os poder escrever. A segurança está em ser **mostrado como texto**
 * e nunca como HTML; limpar aqui daria a ideia de que mostrar de outra
 * maneira passaria a ser seguro, e não passava.
 */
export const normalizarTexto = (bruto: string): string =>
    bruto
        .replace(/\r\n?/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

/**
 * Se um texto tem alguma coisa escrita.
 *
 * Um corpo só com espaços e quebras passa por qualquer contagem de
 * caracteres e não diz nada a ninguém.
 */
export const temConteudo = (texto: string): boolean =>
    normalizarTexto(texto).replace(/\s/gu, '').length > 0;

/**
 * A nota que quem denuncia pode deixar.
 *
 * Curta de propósito. Não é um processo: é o que o moderador precisa de
 * ler para saber onde olhar. "O terceiro parágrafo é uma ameaça" chega,
 * e cabe. Quem precisar de escrever mais do que isto tem um email na
 * página de privacidade.
 */
export const NOTA_MAXIMA = 500;

/** Quantas denúncias por página na fila de quem modera. */
export const DENUNCIAS_POR_PAGINA = 20;
