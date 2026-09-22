import { XMLParser } from 'fast-xml-parser';

import { enderecoSeguro, excertoDe, soTexto } from '@vicehub/database';

/**
 * Uma notícia lida de um feed, já reduzida ao que guardamos.
 */
export interface NoticiaLida {
    guid: string;
    title: string;
    excerpt: string | null;
    url: string;
    imageUrl: string | null;
    publishedAt: Date;
}

export interface FeedLido {
    /** Como a fonte se chama a si própria. */
    sourceName: string;
    noticias: NoticiaLida[];
}

/**
 * Quantas se leem de uma passagem.
 *
 * Um feed é um ficheiro de fora, e um ficheiro de fora pode ter dez mil
 * entradas — por engano de quem o gera ou de propósito. Só se guardam
 * algumas dezenas, por isso ler mais do que isto é trabalho que se
 * deita fora a seguir.
 */
const MAXIMO_POR_PASSAGEM = 60;

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    /**
     * O texto de um elemento com atributos fica aqui. Sem nome próprio,
     * o parser usa `#text`, que colide com o que às vezes é um campo.
     */
    textNodeName: '$texto',
    /**
     * Um feed com um item só daria um objeto em vez de uma lista, e o
     * código teria de tratar dois casos. Isto obriga sempre à lista.
     */
    isArray: (nome) => nome === 'item' || nome === 'entry',
    trimValues: true,
});

/** O primeiro valor que exista, já em texto. */
const texto = (valor: unknown): string | null => {
    if (typeof valor === 'string') {
        return valor;
    }

    if (typeof valor === 'number') {
        return String(valor);
    }

    if (valor && typeof valor === 'object') {
        const dentro = valor as Record<string, unknown>;

        if (typeof dentro['$texto'] === 'string') {
            return dentro['$texto'];
        }
    }

    return null;
};

/** O `href` de um `<link>` de Atom, ou o texto de um `<link>` de RSS. */
const enderecoDe = (entrada: Record<string, unknown>): string | null => {
    const bruto = entrada['link'];

    if (typeof bruto === 'string') {
        return bruto;
    }

    /**
     * O Atom traz vários `<link>`, e o que interessa é o `alternate` —
     * os outros apontam para o próprio feed ou para comentários.
     */
    const lista = Array.isArray(bruto) ? bruto : [bruto];

    for (const candidato of lista) {
        if (!candidato || typeof candidato !== 'object') {
            continue;
        }

        const atributos = candidato as Record<string, unknown>;
        const rel = atributos['@rel'];

        if (rel === undefined || rel === 'alternate') {
            const href = atributos['@href'];

            if (typeof href === 'string') {
                return href;
            }
        }
    }

    return null;
};

/**
 * A imagem do artigo, quando o feed a der.
 *
 * Cada gerador de feeds inventa o seu sítio para ela. Estes três cobrem
 * a esmagadora maioria; não havendo nenhum, fica sem imagem — que é um
 * caso normal e não uma falha.
 */
const imagemDe = (entrada: Record<string, unknown>): string | null => {
    const candidatos = [
        (entrada['media:content'] as Record<string, unknown>)?.['@url'],
        (entrada['media:thumbnail'] as Record<string, unknown>)?.['@url'],
        (entrada['enclosure'] as Record<string, unknown>)?.['@url'],
    ];

    for (const candidato of candidatos) {
        if (typeof candidato === 'string' && enderecoSeguro(candidato)) {
            return candidato;
        }
    }

    return null;
};

/** A data de publicação, do campo que o formato usar. */
const dataDe = (entrada: Record<string, unknown>): Date | null => {
    for (const campo of ['pubDate', 'published', 'updated', 'dc:date']) {
        const bruto = texto(entrada[campo]);

        if (bruto === null) {
            continue;
        }

        const quando = new Date(bruto);

        if (!Number.isNaN(quando.getTime())) {
            return quando;
        }
    }

    return null;
};

/**
 * Lê um feed RSS ou Atom.
 *
 * Nada do que vem lá dentro é de confiança: é um ficheiro que outra
 * pessoa gera e que pode mudar de forma sem aviso. Por isso cada entrada
 * é confirmada antes de contar, e uma que não sirva é **saltada** em vez
 * de fazer a recolha inteira falhar — uma notícia malformada não é razão
 * para o bloco ficar vazio.
 *
 * Devolve `null` quando o que chegou não é um feed de todo.
 */
export const lerFeed = (xml: string): FeedLido | null => {
    let arvore: Record<string, unknown>;

    try {
        arvore = parser.parse(xml) as Record<string, unknown>;
    } catch {
        return null;
    }

    const canal = (arvore['rss'] as Record<string, unknown>)?.['channel'] as
        | Record<string, unknown>
        | undefined;
    const atom = arvore['feed'] as Record<string, unknown> | undefined;

    const raiz = canal ?? atom;

    if (!raiz) {
        return null;
    }

    const entradas = (raiz['item'] ?? raiz['entry'] ?? []) as Record<
        string,
        unknown
    >[];

    const sourceName = soTexto(texto(raiz['title']) ?? '') || 'Notícias';

    const noticias: NoticiaLida[] = [];

    for (const entrada of entradas.slice(0, MAXIMO_POR_PASSAGEM)) {
        const url = enderecoDe(entrada);
        const title = soTexto(texto(entrada['title']) ?? '');
        const publishedAt = dataDe(entrada);

        /**
         * Sem endereço não há para onde mandar ninguém, sem título não
         * há o que mostrar, e sem data não há por onde ordenar. Faltando
         * qualquer um dos três, a entrada não serve.
         */
        if (url === null || !enderecoSeguro(url) || title === '' || publishedAt === null) {
            continue;
        }

        const corpo
            = texto(entrada['description'])
            ?? texto(entrada['summary'])
            ?? texto(entrada['content'])
            ?? texto(entrada['content:encoded']);

        const excerto = corpo === null ? '' : excertoDe(corpo);

        noticias.push({
            /**
             * O `guid` do feed quando existe; o endereço quando não. O
             * endereço é a segunda coisa mais estável que um artigo tem,
             * e é melhor chave do que o título, que se corrige.
             */
            guid: soTexto(texto(entrada['guid']) ?? texto(entrada['id']) ?? url),
            title,
            excerpt: excerto === '' ? null : excerto,
            url,
            imageUrl: imagemDe(entrada),
            publishedAt,
        });
    }

    return { sourceName, noticias };
};

/**
 * Os feeds que uma página diz ter.
 *
 * É assim que se **procura** um feed em vez de o adivinhar: quem publica
 * um declara-o no `<head>` com o tipo do feed, e é isso que qualquer
 * leitor de RSS procura quando lhe dão o endereço de um site em vez do
 * endereço de um feed.
 *
 * A leitura é por expressão regular e não por um analisador de HTML, de
 * propósito: o que interessa daqui são umas quantas etiquetas `<link>`
 * no cabeçalho, e trazer um analisador inteiro para isso era trazer
 * mais superfície do que a que se ganha. HTML mal formado não é
 * problema — uma etiqueta que não case simplesmente não aparece na
 * lista, que é o mesmo que a página não a ter.
 *
 * Os endereços vêm resolvidos contra a página, porque quase todos são
 * relativos, e sem repetições — `/feed` e `/feed` declarados duas vezes
 * são um feed.
 */
export const feedsDeclaradosEm = (html: string, pagina: string): string[] => {
    const encontrados: string[] = [];

    for (const etiqueta of html.match(/<link\b[^>]*>/gi) ?? []) {
        /**
         * O `type` é a regra, e é a regra toda.
         *
         * O `rel` chegou a ser conferido aqui também — `alternate`, que
         * é o que a norma diz. Só que há sítios a declarar `rel="feed"`
         * e outros `rel="alternate feed"`, e a conferência a mais não
         * acrescentava nada: o que faz de uma etiqueta uma declaração de
         * feed é ela apontar para um, e é o `type` que diz isso. Duas
         * maneiras de escrever a mesma regra é uma delas a ficar para
         * trás sem ninguém dar por isso.
         */
        if (!/\btype\s*=\s*["']?application\/(rss|atom)\+xml/i.test(etiqueta)) {
            continue;
        }

        const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+))/i.exec(
            etiqueta,
        );

        const bruto = href?.[1] ?? href?.[2] ?? href?.[3];

        if (bruto === undefined || bruto === '') {
            continue;
        }

        let absoluto: string;

        try {
            absoluto = new URL(bruto, pagina).href;
        } catch {
            continue;
        }

        /**
         * `enderecoSeguro` corta aqui o mesmo que corta nas notícias:
         * uma página pode declarar um `javascript:` ou um `data:` como
         * feed, e isto vai parar a uma configuração que alguém copia.
         */
        if (!enderecoSeguro(absoluto) || encontrados.includes(absoluto)) {
            continue;
        }

        encontrados.push(absoluto);
    }

    return encontrados;
};
