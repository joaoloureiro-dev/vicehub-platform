import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * O que o browser desenha sozinho, e que não lê a nossa folha.
 *
 * Uma caixa de escolha, um rádio, a barra de rolar, o calendário de um
 * campo de data, o quadrado de um `input[type=color]`: nada disto é
 * nosso. O browser pinta-os claros por omissão, e numa página de noite
 * uma caixa branca lê-se como uma avaria — foi assim que apareceu nas
 * definições de uma crew, um quadrado branco no meio de um formulário
 * escuro, depois de a paleta ter mudado e ninguém ter avisado o browser.
 *
 * A maneira de avisar é uma linha, `color-scheme`, e tem de estar em
 * dois sítios por razões diferentes:
 *
 * - no `:root` da folha, que é o que pinta os controlos;
 * - no `<head>`, que é o que pinta a **tela** antes de a folha chegar —
 *   sem ele, o primeiro instante de cada carregamento é branco.
 *
 * E a cor da barra do sistema vai escrita à mão em dois ficheiros que
 * não sabem ler um token de CSS. São dois sítios onde a mesma cor pode
 * ficar para trás, e é isso que este ficheiro vigia.
 */
const leia = (relativo: string): string =>
    readFileSync(path.resolve(import.meta.dirname, relativo), 'utf8');

const CSS = leia('../src/styles/theme.css');
const HTML = leia('../index.html');
const MANIFESTO = JSON.parse(leia('../public/manifest.webmanifest')) as Record<
    string,
    unknown
>;

/** O `:root`, que é onde os tokens são declarados e não usados. */
const RAIZ = CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('\n}', CSS.indexOf(':root {')));

const FUNDO = RAIZ.match(/--ground:\s*(#[0-9a-f]{6})/iu)?.[1];

describe('os controlos que o browser desenha', () => {
    it('sabem a que horas é, pela folha', () => {
        expect(RAIZ).toMatch(/color-scheme:\s*dark/u);
    });

    it('e pela cabeça da página, antes de a folha chegar', () => {
        expect(HTML).toMatch(
            /<meta\s+name="color-scheme"\s+content="dark"\s*\/?>/u,
        );
    });

    /**
     * E a etiqueta fica ao lado da caixa, e não por baixo dela.
     *
     * `.field` empilha em coluna, que é o que serve um campo de texto
     * com a etiqueta por cima. `.field-inline` existe para desfazer isso
     * — e durante todo este tempo não desfazia: punha `display: flex` e
     * `align-items: center` e deixava a direção como estava. A caixa
     * ficava por cima da frase que se está a marcar, centrada, com a
     * frase encostada à direita.
     */
    it('ficam ao lado da frase que se marca', () => {
        const inicio = CSS.indexOf('.field-inline {');

        expect(inicio, 'a regra .field-inline não existe').toBeGreaterThan(-1);

        expect(CSS.slice(inicio, CSS.indexOf('\n}', inicio)))
            .toMatch(/flex-direction:\s*row/u);
    });

    /**
     * A cor de escolhido é uma, e está dita uma vez.
     *
     * Antes estava em três regras, com duas cores diferentes, e as
     * outras cinco caixas do produto não tinham nenhuma — três
     * ortografias de uma regra, que é como um produto acaba com duas
     * cores de "sim". Herdada da raiz, chega a todas.
     */
    it('têm uma cor de escolhido, e uma só', () => {
        const declaracoes = [...CSS.matchAll(/accent-color:/gu)];

        expect(declaracoes).toHaveLength(1);
        expect(RAIZ).toMatch(/accent-color:\s*var\(--[a-z-]+\)/u);
    });
});

/**
 * O anel de foco é o sinal de onde está o teclado, e mais nada.
 *
 * É o outro desenho que o browser faz por nós e que a folha substitui —
 * e por isso tem de continuar a querer dizer uma coisa só. Estava a
 * servir de halo decorativo a um ponto verde de servidor online: um anel
 * ciano à volta de uma coisa verde, invisível enquanto era um teal
 * pálido de tema claro e impossível de não ver assim que passou a
 * acender. Usado como decoração, deixa de se ler como foco.
 */
describe('o anel de foco', () => {
    it('só aparece onde há foco', () => {
        const linhas = CSS.split('\n');

        const foraDoFoco = linhas
            .map((linha, indice) => ({ linha, indice }))
            .filter(({ linha }) => linha.includes('var(--focus-ring)'))
            .map(({ indice }) => {
                let cursor = indice;

                while (cursor > 0 && !linhas[cursor]?.includes('{')) {
                    cursor -= 1;
                }

                return (linhas[cursor] ?? '').replace('{', '').trim();
            })
            .filter((seletor) => !seletor.includes(':focus'));

        expect(
            foraDoFoco,
            'o anel de foco não é decoração: usa a própria cor',
        ).toEqual([]);
    });
});

describe('a cor da barra do sistema', () => {
    it('é a mesma que a página, na cabeça', () => {
        expect(FUNDO, 'o token --ground não existe').toBeDefined();

        const escrita = HTML.match(
            /<meta\s+name="theme-color"\s+content="(#[0-9a-f]{6})"/iu,
        )?.[1];

        expect(escrita?.toLowerCase()).toBe(FUNDO!.toLowerCase());
    });

    /**
     * E no manifesto, que é lido pelo instalador da app e não pelo
     * browser. Ficou para trás uma vez — com `#08060F`, de uma paleta
     * anterior —, e ninguém deu por isso porque só se vê com a app
     * instalada no telemóvel.
     */
    it.each(['theme_color', 'background_color'])('e no manifesto, em %s', (campo) => {
        expect(String(MANIFESTO[campo]).toLowerCase()).toBe(FUNDO!.toLowerCase());
    });
});
