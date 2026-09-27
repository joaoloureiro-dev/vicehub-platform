import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Um documento, um idioma.
 *
 * O ViceHub escreve em dois idiomas de propósito, e cada um tem o seu
 * lugar:
 *
 * - **português** no que é interno — o código, os comentários, o readme,
 *   os documentos de `docs/`;
 * - **inglês** no que sai cá para fora — o produto, e o texto que vai
 *   para o X ou para onde for.
 *
 * O que não pode é um documento ter os dois. E teve: metade do `readme.md`
 * estava em inglês — a visão, o que o produto faz, a arquitetura, a
 * segurança, o desenho — e a outra metade em português, a partir de
 * "Desenvolvimento". Ninguém escreveu isso de uma vez; foi-se acumulando,
 * uma secção nova de cada vez, e cada uma parecia razoável sozinha.
 *
 * Por isso é um teste e não uma regra escrita num sítio qualquer: a única
 * altura em que alguém repara é quando lhe falha alguma coisa.
 */
const RAIZ = path.resolve(import.meta.dirname, '../../..');

/**
 * Palavras que só aparecem a sério quando se está mesmo a escrever
 * naquele idioma.
 *
 * São palavras de ligação, e não substantivos: `server`, `token` e
 * `commit` aparecem em português técnico a toda a hora, e contá-las daria
 * inglês a qualquer parágrafo sobre uma API.
 */
const PORTUGUES =
    /\b(que|não|para|uma|com|isto|onde|porque|quem|está|mais|cada|pelo|aqui|assim|então|só|tem|são|sem|nada|também|quando|depois|antes|entre|sobre|mesmo|qual|deste|desta|nesta|neste)\b/giu;

const INGLES =
    /\b(the|that|with|from|which|because|there|what|this|each|these|those|when|after|before|between|about|another|does|would|should|every|while|whose)\b/giu;

/**
 * Conta só o que é prosa.
 *
 * Blocos de código, comandos e nomes de ficheiro estão em inglês em
 * qualquer documento português — `npm run dev` não é uma frase. Contá-los
 * dava mistura em toda a parte e o teste passava a mentir.
 */
const prosa = (texto: string): string =>
    texto
        .replace(/```[\s\S]*?```/gu, ' ')
        .replace(/`[^`\n]*`/gu, ' ')
        .replace(/^\s{4,}\S.*$/gmu, ' ');

/** As secções de um markdown, pelo título de nível 2 ou 3. */
const seccoes = (texto: string): { titulo: string; corpo: string }[] => {
    const partes: { titulo: string; corpo: string }[] = [];
    let titulo = '(antes do primeiro título)';
    let corpo: string[] = [];

    for (const linha of texto.split('\n')) {
        if (/^#{1,3} /u.test(linha)) {
            partes.push({ titulo, corpo: corpo.join('\n') });
            titulo = linha.replace(/^#+\s*/u, '').trim();
            corpo = [];
        } else {
            corpo.push(linha);
        }
    }

    partes.push({ titulo, corpo: corpo.join('\n') });

    return partes;
};

/**
 * Os documentos que são portugueses, e que têm de o ser por inteiro.
 *
 * Escrita à mão, e não «todos os `.md`»: `docs/press/` e `docs/social/`
 * são o contrário — texto para publicar, em inglês, com um cabeçalho
 * português à volta a dizer onde se cola. Esses obedecem à mesma regra
 * ao contrário, e não é este teste que a verifica.
 */
const EM_PORTUGUES = [
    'readme.md',
    'docs/media/tema/readme.md',
    'docs/media/readme.md',
    'docs/precos.md',
];

describe('cada documento num idioma só', () => {
    it.each(EM_PORTUGUES)('%s está todo em português', (ficheiro) => {
        const texto = readFileSync(path.join(RAIZ, ficheiro), 'utf8');

        const emIngles = seccoes(texto)
            .map(({ titulo, corpo }) => {
                const limpo = prosa(corpo);
                const pt = limpo.match(PORTUGUES)?.length ?? 0;
                const en = limpo.match(INGLES)?.length ?? 0;

                return { titulo, pt, en };
            })
            /*
             * Um limiar, e não «zero inglês»: uma secção portuguesa pode
             * citar o nome de um ecrã ou uma frase do produto sem deixar
             * de ser portuguesa. O que isto apanha é uma secção inteira
             * escrita no outro idioma.
             *
             * E apanha **prosa**, que é onde a coisa acontece: alguém
             * senta-se a escrever um parágrafo e escreve-o no idioma em
             * que estava a pensar. Uma lista de três palavras — «Amigos e
             * grafo social» — não tem palavras de ligação nenhumas e é
             * indistinguível da inglesa; para essas não há medida, e
             * também não são elas que fazem um documento mudar de idioma
             * a meio. Contra o readme como estava, isto acusava seis das
             * secções.
             */
            .filter(({ pt, en }) => pt + en >= 4 && en > pt)
            .map(({ titulo, pt, en }) => `${titulo} (pt=${pt}, en=${en})`);

        expect(
            emIngles,
            'estas secções estão em inglês num documento português',
        ).toEqual([]);
    });
});
