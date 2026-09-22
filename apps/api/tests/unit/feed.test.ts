import { describe, expect, it } from 'vitest';

import { EXCERTO_MAXIMO } from '@vicehub/database';
import { feedsDeclaradosEm, lerFeed } from '../../src/shared/feed.js';

/**
 * Ler um ficheiro que outra pessoa gera.
 *
 * Um feed não é uma API nossa: muda de forma sem aviso, vem em dois
 * formatos que não se parecem, e às vezes vem partido. O que aqui se
 * verifica não é "consegue ler um feed bonito" — é o que acontece com
 * os feios, que são a maioria.
 */
const rss = (itens: string, titulo = 'Rockstar Newswire'): string => `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${titulo}</title>
    ${itens}
  </channel>
</rss>`;

const item = (dentro: string): string => `<item>${dentro}</item>`;

describe('ler um feed', () => {
    it('lê o nome da fonte do próprio feed', () => {
        const lido = lerFeed(rss(item(`
            <title>Uma notícia</title>
            <link>https://exemplo.test/a</link>
            <pubDate>Tue, 15 Sep 2026 10:00:00 GMT</pubDate>
        `)));

        expect(lido?.sourceName).toBe('Rockstar Newswire');
    });

    it('lê título, endereço e data de um item de RSS', () => {
        const lido = lerFeed(rss(item(`
            <title>Atualização de outono</title>
            <link>https://exemplo.test/outono</link>
            <description>Chega esta semana, com carros novos.</description>
            <pubDate>Tue, 15 Sep 2026 10:00:00 GMT</pubDate>
        `)));

        expect(lido?.noticias).toHaveLength(1);
        expect(lido?.noticias[0]).toMatchObject({
            title: 'Atualização de outono',
            url: 'https://exemplo.test/outono',
            excerpt: 'Chega esta semana, com carros novos.',
        });
        expect(lido?.noticias[0]?.publishedAt.getUTCFullYear()).toBe(2026);
    });

    /**
     * O Atom não se parece nada com o RSS: os itens são `entry`, o
     * endereço está num atributo, e há vários `link` por entrada.
     */
    it('lê também Atom, onde o endereço está num atributo', () => {
        const lido = lerFeed(`<?xml version="1.0"?>
            <feed xmlns="http://www.w3.org/2005/Atom">
              <title>Newswire</title>
              <entry>
                <title>Uma entrada</title>
                <link rel="self" href="https://exemplo.test/feed"/>
                <link rel="alternate" href="https://exemplo.test/artigo"/>
                <summary>O resumo.</summary>
                <published>2026-09-15T10:00:00Z</published>
              </entry>
            </feed>`);

        expect(lido?.noticias[0]?.url).toBe('https://exemplo.test/artigo');
    });

    /**
     * O que um agregador **não** faz é copiar o artigo. O corte é a
     * funcionalidade, e não uma poupança de espaço.
     */
    it('corta o texto no excerto', () => {
        const longo = 'palavra '.repeat(200);

        const lido = lerFeed(rss(item(`
            <title>Um artigo comprido</title>
            <link>https://exemplo.test/longo</link>
            <description>${longo}</description>
            <pubDate>Tue, 15 Sep 2026 10:00:00 GMT</pubDate>
        `)));

        const excerto = lido?.noticias[0]?.excerpt ?? '';

        expect(excerto.length).toBeLessThanOrEqual(EXCERTO_MAXIMO + 1);
        expect(excerto.endsWith('…')).toBe(true);
    });

    /** E corta entre palavras, porque cortar a meio lê-se como avaria. */
    it('não parte uma palavra ao meio', () => {
        const lido = lerFeed(rss(item(`
            <title>Outro</title>
            <link>https://exemplo.test/outro</link>
            <description>${'abcdefgh '.repeat(40)}</description>
            <pubDate>Tue, 15 Sep 2026 10:00:00 GMT</pubDate>
        `)));

        const excerto = (lido?.noticias[0]?.excerpt ?? '').replace('…', '');

        expect(excerto.endsWith('abcdefgh')).toBe(true);
    });

    /** A marcação do feed não passa: o que se guarda é texto. */
    it('deita fora a marcação que vem na descrição', () => {
        const lido = lerFeed(rss(item(`
            <title>Com marcação</title>
            <link>https://exemplo.test/m</link>
            <description>&lt;p&gt;Texto &lt;a href="x"&gt;com link&lt;/a&gt;.&lt;/p&gt;</description>
            <pubDate>Tue, 15 Sep 2026 10:00:00 GMT</pubDate>
        `)));

        expect(lido?.noticias[0]?.excerpt).toBe('Texto com link.');
    });

    /**
     * O caso que apareceu no primeiro feed a sério.
     *
     * Um título com acentos vem escrito em entidades numéricas, e num
     * produto em português isso é uma palavra em cada duas. Sem isto, a
     * página de entrada mostrava "Atualiza&#231;&#227;o de setembro".
     */
    it('devolve os acentos escritos em entidades', () => {
        const lido = lerFeed(rss(item(`
            <title>Atualiza&amp;#231;&amp;#227;o de setembro</title>
            <link>https://exemplo.test/set</link>
            <description>Ve&amp;#237;culos novos e correc&amp;#231;&amp;#245;es.</description>
            <pubDate>Tue, 15 Sep 2026 10:00:00 GMT</pubDate>
        `)));

        expect(lido?.noticias[0]?.title).toBe('Atualização de setembro');
        expect(lido?.noticias[0]?.excerpt).toBe('Veículos novos e correcções.');
    });

    /** E as hexadecimais, que o mesmo feed mistura com as decimais. */
    it('devolve também as entidades em hexadecimal', () => {
        const lido = lerFeed(rss(item(`
            <title>Cora&amp;#xE7;&amp;#xE3;o</title>
            <link>https://exemplo.test/h</link>
            <pubDate>Tue, 15 Sep 2026 10:00:00 GMT</pubDate>
        `)));

        expect(lido?.noticias[0]?.title).toBe('Coração');
    });

    /**
     * Um `&` escapado duas vezes não vira uma etiqueta.
     *
     * `&amp;lt;` é um autor a escrever a sequência `&lt;` literalmente.
     * Desfazer o `&amp;` antes do `&lt;` dava um `<` que ele nunca
     * escreveu — e a partir daí tudo até ao `>` seguinte desaparecia
     * como se fosse marcação.
     */
    it('não inventa marcação a partir de um & escapado duas vezes', () => {
        const lido = lerFeed(rss(item(`
            <title>Escrever &amp;amp;lt;b&amp;amp;gt; num texto</title>
            <link>https://exemplo.test/e</link>
            <pubDate>Tue, 15 Sep 2026 10:00:00 GMT</pubDate>
        `)));

        expect(lido?.noticias[0]?.title).toBe('Escrever &lt;b&gt; num texto');
    });

    /**
     * O caso que torna isto uma arma se passar: um endereço que não é um
     * endereço. O `href` sai daqui e vai direito para um link no ecrã.
     */
    it('recusa um endereço que não é http nem https', () => {
        const lido = lerFeed(rss(item(`
            <title>Malicioso</title>
            <link>javascript:alert(1)</link>
            <pubDate>Tue, 15 Sep 2026 10:00:00 GMT</pubDate>
        `)));

        expect(lido?.noticias).toHaveLength(0);
    });

    /**
     * Uma entrada partida não estraga as outras. O bloco ficar vazio
     * porque uma notícia veio sem data seria o feed de outra pessoa a
     * decidir o que a nossa página mostra.
     */
    it('salta o que não serve e fica com o resto', () => {
        const lido = lerFeed(rss(
            item('<title>Sem link nem data</title>')
            + item(`
                <title>Esta serve</title>
                <link>https://exemplo.test/boa</link>
                <pubDate>Tue, 15 Sep 2026 10:00:00 GMT</pubDate>
            `)
            + item('<link>https://exemplo.test/sem-titulo</link>'),
        ));

        expect(lido?.noticias).toHaveLength(1);
        expect(lido?.noticias[0]?.title).toBe('Esta serve');
    });

    /** Sem `guid`, o endereço serve de chave — é o que o artigo tem de mais estável. */
    it('usa o endereço como chave quando não há guid', () => {
        const lido = lerFeed(rss(item(`
            <title>Sem guid</title>
            <link>https://exemplo.test/chave</link>
            <pubDate>Tue, 15 Sep 2026 10:00:00 GMT</pubDate>
        `)));

        expect(lido?.noticias[0]?.guid).toBe('https://exemplo.test/chave');
    });

    it('prefere o guid quando o feed o dá', () => {
        const lido = lerFeed(rss(item(`
            <title>Com guid</title>
            <guid isPermaLink="false">nw-12345</guid>
            <link>https://exemplo.test/chave</link>
            <pubDate>Tue, 15 Sep 2026 10:00:00 GMT</pubDate>
        `)));

        expect(lido?.noticias[0]?.guid).toBe('nw-12345');
    });

    it('lê a imagem quando o feed a dá', () => {
        const lido = lerFeed(rss(item(`
            <title>Com imagem</title>
            <link>https://exemplo.test/i</link>
            <media:content url="https://exemplo.test/foto.jpg"/>
            <pubDate>Tue, 15 Sep 2026 10:00:00 GMT</pubDate>
        `)));

        expect(lido?.noticias[0]?.imageUrl).toBe('https://exemplo.test/foto.jpg');
    });

    it('não inventa imagem quando o feed não a dá', () => {
        const lido = lerFeed(rss(item(`
            <title>Sem imagem</title>
            <link>https://exemplo.test/s</link>
            <pubDate>Tue, 15 Sep 2026 10:00:00 GMT</pubDate>
        `)));

        expect(lido?.noticias[0]?.imageUrl).toBeNull();
    });

    /** Um feed com um item só não é um caso especial. */
    it('lê um feed com um único item', () => {
        const lido = lerFeed(rss(item(`
            <title>Só uma</title>
            <link>https://exemplo.test/u</link>
            <pubDate>Tue, 15 Sep 2026 10:00:00 GMT</pubDate>
        `)));

        expect(lido?.noticias).toHaveLength(1);
    });

    it.each([
        ['vazio', ''],
        ['XML que não é feed', '<?xml version="1.0"?><outra-coisa/>'],
        ['HTML', '<!doctype html><html><body>Não sou um feed</body></html>'],
        ['lixo', 'isto não é nada'],
    ])('devolve nulo com %s', (_nome, corpo) => {
        expect(lerFeed(corpo)).toBeNull();
    });

    /** Um feed sem itens é um feed válido e vazio, não uma avaria. */
    it('lê um feed sem itens nenhuns', () => {
        const lido = lerFeed(rss(''));

        expect(lido).not.toBeNull();
        expect(lido?.noticias).toHaveLength(0);
    });
});

/**
 * Procurar o feed em vez de o adivinhar.
 *
 * Quem publica um feed declara-o no `<head>`. Adivinhar endereços é o
 * que se faz quando não se lê o que a página diz — e dá a um site que
 * responde 200 a tudo a oportunidade de parecer que tem feed.
 */
describe('procurar o feed que uma página declara', () => {
    const pagina = 'https://exemplo.test/noticias';

    const comCabeca = (dentro: string): string =>
        `<!doctype html><html><head>${dentro}</head><body>nada</body></html>`;

    it('encontra um feed RSS declarado', () => {
        const html = comCabeca(
            '<link rel="alternate" type="application/rss+xml" href="/feed.rss">',
        );

        expect(feedsDeclaradosEm(html, pagina)).toEqual([
            'https://exemplo.test/feed.rss',
        ]);
    });

    it('encontra um feed Atom', () => {
        const html = comCabeca(
            '<link rel="alternate" type="application/atom+xml" href="https://exemplo.test/atom.xml">',
        );

        expect(feedsDeclaradosEm(html, pagina)).toEqual([
            'https://exemplo.test/atom.xml',
        ]);
    });

    /** Quase todos são relativos, e um relativo por resolver não serve. */
    it('resolve o endereço contra a página onde estava', () => {
        const html = comCabeca(
            '<link rel="alternate" type="application/rss+xml" href="rss">',
        );

        expect(feedsDeclaradosEm(html, 'https://exemplo.test/a/b')).toEqual([
            'https://exemplo.test/a/rss',
        ]);
    });

    it('lê o href com aspas simples, sem aspas, e a etiqueta fechada', () => {
        const html = comCabeca(`
            <link rel='alternate' type='application/rss+xml' href='/um.rss'/>
            <link rel=alternate type=application/rss+xml href=/dois.rss>
        `);

        expect(feedsDeclaradosEm(html, pagina)).toEqual([
            'https://exemplo.test/um.rss',
            'https://exemplo.test/dois.rss',
        ]);
    });

    it('não repete o mesmo feed declarado duas vezes', () => {
        const html = comCabeca(`
            <link rel="alternate" type="application/rss+xml" href="/feed.rss">
            <link rel="alternate" type="application/rss+xml" href="/feed.rss">
        `);

        expect(feedsDeclaradosEm(html, pagina)).toHaveLength(1);
    });

    /**
     * O que faz de uma etiqueta um feed é o `type`, e mais nada.
     *
     * Há sítios a declarar `rel="feed"` e outros `rel="alternate feed"`.
     * Exigir a palavra `alternate` deixava esses de fora sem ganhar
     * coisa nenhuma — e era uma segunda maneira de escrever a mesma
     * regra.
     */
    it.each([
        'feed',
        'alternate feed',
        'alternate',
    ])('encontra o feed declarado com rel="%s"', (rel) => {
        const html = comCabeca(
            `<link rel="${rel}" type="application/rss+xml" href="/feed.rss">`,
        );

        expect(feedsDeclaradosEm(html, pagina)).toEqual([
            'https://exemplo.test/feed.rss',
        ]);
    });

    /**
     * `rel="alternate"` sozinho é outra coisa: é a mesma página noutro
     * idioma, e é o que toda a gente tem. O que a torna um feed é o
     * `type`.
     */
    it('ignora um alternate que não é feed', () => {
        const html = comCabeca(
            '<link rel="alternate" hreflang="pt" href="https://exemplo.test/pt">',
        );

        expect(feedsDeclaradosEm(html, pagina)).toEqual([]);
    });

    it('ignora uma folha de estilo e um ícone', () => {
        const html = comCabeca(`
            <link rel="stylesheet" href="/estilo.css">
            <link rel="icon" href="/favicon.ico">
        `);

        expect(feedsDeclaradosEm(html, pagina)).toEqual([]);
    });

    /**
     * Isto vai parar a uma variável de configuração que alguém copia do
     * ecrã para o `.env`. Um `javascript:` declarado como feed não tem
     * de chegar lá.
     */
    it('recusa um endereço que não seja http nem https', () => {
        const html = comCabeca(
            '<link rel="alternate" type="application/rss+xml" href="javascript:alert(1)">',
        );

        expect(feedsDeclaradosEm(html, pagina)).toEqual([]);
    });

    it('não se engasga com uma página sem cabeça nenhuma', () => {
        expect(feedsDeclaradosEm('', pagina)).toEqual([]);
        expect(feedsDeclaradosEm('<html><body>oi', pagina)).toEqual([]);
    });

    /**
     * O caso que motivou tudo isto: uma página que é uma aplicação e
     * não declara feed nenhum. A resposta certa é "não tem", e não um
     * endereço inventado.
     */
    it('diz que não há quando a página não declara nenhum', () => {
        const html = comCabeca(
            '<title>Newswire</title><script src="/app.js"></script>',
        );

        expect(feedsDeclaradosEm(html, pagina)).toEqual([]);
    });
});
