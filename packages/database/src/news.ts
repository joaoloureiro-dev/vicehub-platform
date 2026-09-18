/**
 * O que a plataforma guarda de uma notícia de fora, e porquê tão pouco.
 *
 * O bloco da página de entrada é um **agregador**, e não uma republicação.
 * A diferença não é de arrumação: o artigo é de quem o escreveu, e
 * copiá-lo para aqui seria pegar no trabalho de outra pessoa. O que se
 * mostra é o título, um excerto curto, a fonte à vista e o link para lá
 * — que é o que qualquer agregador faz e o que se aguenta.
 *
 * É por isso que o excerto tem um teto em vez de guardar o texto todo.
 * O limite **é** a funcionalidade, e não uma otimização de espaço.
 */

/**
 * Quanto do texto de origem é excerto.
 *
 * Duas ou três frases: o suficiente para decidir se se quer ler, e longe
 * de substituir a leitura. Quem quiser mais segue o link, que é o ponto.
 */
export const EXCERTO_MAXIMO = 220;

/** Quantas aparecem na página de entrada. */
export const NOTICIAS_NA_ENTRADA = 4;

/**
 * Quantas se guardam ao todo.
 *
 * Um feed devolve as mais recentes e esquece o resto; guardar tudo para
 * sempre faria a tabela crescer sozinha para mostrar quatro. O que passa
 * deste número é apagado a cada recolha.
 */
export const NOTICIAS_GUARDADAS = 40;

/**
 * Devolve as entidades ao que elas representam.
 *
 * Um feed escreve os acentos como `&#231;` ou `&ccedil;` com uma
 * frequência que num produto em português é uma palavra em cada duas —
 * e um título que apareça como "Atualiza&#231;&#227;o" não é um detalhe,
 * é o bloco todo a parecer partido.
 *
 * As numéricas cobrem-se por cálculo, que é o que as torna completas: há
 * milhares e listá-las à mão seria listar sempre mal. As nomeadas são só
 * as cinco do XML mais o espaço duro, porque as outras centenas são
 * específicas do HTML e num feed aparecem escritas em numérico.
 *
 * Corre **antes** de tirar a marcação, e a ordem é o ponto: um
 * `&lt;p&gt;` escapado é um parágrafo que o autor quis, e descodificado
 * primeiro desaparece com as outras etiquetas. Ao contrário, ficava
 * texto com `<p>` lá dentro.
 */
const semEntidades = (bruto: string): string =>
    bruto
        .replace(/&#x([0-9a-f]+);/gi, (_todo, hex: string) =>
            String.fromCodePoint(Number.parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_todo, base10: string) =>
            String.fromCodePoint(Number.parseInt(base10, 10)))
        .replace(/&nbsp;/gi, ' ')
        .replace(/&quot;/gi, '"')
        .replace(/&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        /*
         * O `&amp;` fica para o fim, e tem de ficar: feito primeiro,
         * transformava `&amp;lt;` em `&lt;` e a passagem seguinte
         * fazia dele um `<` que o autor nunca escreveu.
         */
        .replace(/&amp;/gi, '&');

/**
 * Limpa o texto que vem de um feed.
 *
 * As descrições costumam vir com marcação lá dentro — parágrafos, links,
 * imagens — e às vezes com HTML escapado por cima disso. Sai daqui texto
 * e mais nada: é assim que se mostra, e guardar marcação seria guardar
 * uma coisa que ninguém vai usar e que alguém um dia injetaria num
 * `innerHTML` por descuido.
 */
export const soTexto = (bruto: string): string =>
    semEntidades(bruto)
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        /*
         * Uma etiqueta antes de um ponto deixa um espaço no lugar dela,
         * e fica "com link ." em quase todas as descrições — que é a
         * maneira mais barata de um bloco de notícias parecer partido.
         */
        .replace(/\s+([,.;:!?»)\]])/g, '$1')
        .replace(/([«([])\s+/g, '$1')
        .trim();

/**
 * Corta o texto no excerto, sem partir palavras ao meio.
 *
 * Procura o último espaço antes do limite. Cortar a meio de uma palavra
 * lê-se como avaria, e o objetivo é que pareça uma frase interrompida —
 * porque é isso que é.
 */
export const excertoDe = (bruto: string): string => {
    const texto = soTexto(bruto);

    if (texto.length <= EXCERTO_MAXIMO) {
        return texto;
    }

    const cortado = texto.slice(0, EXCERTO_MAXIMO);
    const ultimoEspaco = cortado.lastIndexOf(' ');

    /**
     * Sem espaço nenhum — uma palavra gigante, ou um idioma que não os
     * usa — corta-se no limite. Melhor cortar mal do que não cortar.
     */
    const fim = ultimoEspaco > EXCERTO_MAXIMO / 2 ? ultimoEspaco : EXCERTO_MAXIMO;

    return `${cortado.slice(0, fim).trimEnd()}…`;
};

/**
 * Se um endereço serve para lá mandar alguém.
 *
 * O link vem de fora, e um `javascript:` num atributo `href` é a forma
 * mais barata de transformar um agregador numa arma. Só http e https.
 */
export const enderecoSeguro = (bruto: string): boolean => {
    try {
        const url = new URL(bruto);

        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
};
