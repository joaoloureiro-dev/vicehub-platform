/**
 * O mercado de um servidor.
 *
 * É onde alguém diz que tem um carro para vender e outra pessoa o lê.
 * Três decisões estão tomadas aqui, e todas as outras decorrem delas.
 *
 * **O preço é moeda de jogo.** Não há aqui dinheiro real, e não há
 * pagamento nenhum: o anúncio diz por quanto, e a troca acontece dentro
 * do jogo, entre as duas pessoas. Os termos já proíbem vender seja o que
 * for por dinheiro verdadeiro, e este ficheiro não abre nenhuma porta a
 * isso — não há aqui nada que ligue um anúncio à Stripe.
 *
 * **Um anúncio pertence a um servidor.** Um Banshee vendido num servidor
 * não vale nada noutro: as economias são separadas, e um mercado comum
 * a todos seria uma lista de coisas que ninguém pode comprar. É também
 * o que impede alguém de fora entrar a anunciar em toda a plataforma.
 *
 * **Fechar não é apagar.** Um anúncio vendido continua a ler-se, e o
 * preço por que foi vendido é a única informação que um mercado novo
 * tem sobre quanto valem as coisas. Retirado é outra coisa: é quem
 * anunciou a dizer que já não está para venda.
 */

/**
 * O título de um anúncio.
 *
 * Mais curto do que o de uma pergunta do fórum, e de propósito: "Banshee
 * 900R, pouco uso" diz tudo, e um título comprido numa lista de anúncios
 * empurra o preço para fora do ecrã de um telemóvel.
 */
export const ANUNCIO_TITULO_MINIMO = 6;
export const ANUNCIO_TITULO_MAXIMO = 120;

/**
 * A descrição.
 *
 * O mínimo é baixo porque há anúncios que se esgotam numa linha — um
 * preço e o sítio onde se entrega. O máximo é generoso pela razão de
 * sempre: quem descreve o que vende em detalhe está a poupar uma
 * conversa a alguém.
 */
export const ANUNCIO_CORPO_MINIMO = 10;
export const ANUNCIO_CORPO_MAXIMO = 4_000;

/** Quantos anúncios por página. */
export const ANUNCIOS_POR_PAGINA = 24;

/**
 * O preço mais alto que se pode pedir.
 *
 * Existe um tecto porque o preço é guardado em `BigInt` e mostrado num
 * ecrã: sem limite, um anúncio de mil milhões de milhões quebrava o
 * alinhamento de toda a lista para dizer uma piada. Este chega para
 * qualquer economia de jogo que exista.
 */
export const PRECO_MAXIMO = 999_999_999_999n;

/**
 * O preço mais baixo.
 *
 * Um, e não zero. "De graça" é uma oferta e não uma venda, e um preço
 * de zero num mercado lê-se as mais das vezes como um engano — o campo
 * por preencher, e não a intenção. Quem quer dar uma coisa escreve-o na
 * descrição, que é onde isso se explica.
 */
export const PRECO_MINIMO = 1n;

/**
 * Em que gaveta é que o anúncio cai.
 *
 * Lista fechada, como as razões de uma denúncia, e pela mesma razão: é
 * por aqui que alguém filtra um mercado com trezentos anúncios, e um
 * campo livre daria trezentas gavetas de um anúncio cada.
 *
 * Escolhidas a partir do que se troca num servidor de roleplay, com
 * `other` no fim para o que não coube — sem essa gaveta, o que não
 * coubesse ia parar à gaveta errada e estragava as outras.
 */
export const CATEGORIAS_DE_ANUNCIO = [
    'vehicle',
    'property',
    'business',
    'service',
    'item',
    'other',
] as const;

export type CategoriaDeAnuncio = (typeof CATEGORIAS_DE_ANUNCIO)[number];

/**
 * Em que pé está o anúncio.
 *
 * `sold` e `withdrawn` são as duas maneiras de fechar, e são mesmo
 * diferentes: uma diz por quanto é que a coisa saiu, a outra diz que não
 * saiu. Juntá-las numa só poupava uma coluna e perdia a única série de
 * preços que a plataforma alguma vez vai ter.
 */
export const ESTADOS_DE_ANUNCIO = ['open', 'sold', 'withdrawn'] as const;

export type EstadoDeAnuncio = (typeof ESTADOS_DE_ANUNCIO)[number];

/**
 * Se um estado é de um anúncio já fechado.
 *
 * A pergunta é do estado e não de quem a faz — espalhá-la por
 * comparações a `open` fazia com que um estado novo ficasse de fora de
 * metade dos sítios que decidem se ainda se pode comprar.
 */
export const anuncioEstaFechado = (estado: EstadoDeAnuncio): boolean =>
    estado !== 'open';

/**
 * O preço tal como se lê, sem casas decimais e com os milhares
 * separados pelo idioma de quem lê.
 *
 * A moeda de jogo não tem cêntimos, e mostrar `250000` sem separadores
 * obriga quem lê a contar zeros para distinguir duzentos e cinquenta mil
 * de dois milhões e meio.
 */
export const precoLegivel = (preco: bigint, idioma?: string): string =>
    new Intl.NumberFormat(idioma, { maximumFractionDigits: 0 }).format(preco);
