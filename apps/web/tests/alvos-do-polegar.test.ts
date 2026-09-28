import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * O que se pode tocar tem de ser do tamanho de um polegar.
 *
 * A varredura mede isto num browser a sério e queixa-se de tudo o que
 * se possa carregar com menos de 24 pixels de altura. Mas a varredura
 * não corre no CI — precisa de um browser e de uma base com coisas lá
 * dentro —, e por isso o que ela apanha uma vez pode voltar a entrar
 * sem ninguém dar por isso.
 *
 * Este ficheiro guarda os casos que ela apanhou. O primeiro: **as
 * ligações dentro de
 * uma lista de pessoas**. A linha da lista tem a altura certa, treze
 * pixels de espaço acima e abaixo, mas o espaço é do `li`; o link, em
 * linha, é só a altura do texto — dezoito pixels — e tocar ao lado do
 * nome não abre coisa nenhuma.
 *
 * Esteve assim desde sempre em seis listas, e a varredura nunca o viu
 * porque a única que ela semeava estava vazia. Foi preciso pôr crews a
 * jogar no servidor para o quadro, e a queixa apareceu no mesmo
 * instante.
 *
 * Não se mede aqui a altura desenhada: o jsdom não tem layout nenhum.
 * Mede-se a regra — que ela existe, que tira o link do fluxo em linha,
 * e que o espaço que acrescenta chega para levar dezoito a vinte e
 * quatro.
 */
const CSS = readFileSync(
    path.resolve(import.meta.dirname, '../src/styles/theme.css'),
    'utf8',
);

/** A altura de uma linha de texto nesta lista, medida pela varredura. */
const ALTURA_DO_TEXTO = 18;

/** O mínimo que a varredura exige. */
const MINIMO = 24;

/**
 * Os sítios onde uma ligação é a linha toda.
 *
 * O nome numa lista de pessoas ou de crews, o lugar no diretório, e o
 * nome do evento que deu xp. Todas são a única coisa dentro do seu
 * elemento, e todas eram altas como o texto e mais nada.
 */
const ONDE = ['.pessoas .nome a', '.lugar a', '.ganho-porque a'];

/**
 * A regra que os cobre, seja ela escrita com um seletor ou com três.
 *
 * Procura-se pelo último da lista, que é o que fica agarrado à chaveta;
 * os outros têm de estar no mesmo cabeçalho, ou há um sítio sem regra.
 */
const bloco = (): string => {
    const ultimo = ONDE[ONDE.length - 1] as string;
    const inicio = CSS.indexOf(`\n${ultimo} {`);

    if (inicio === -1) {
        throw new Error(`a folha não tem uma regra para ${ultimo}.`);
    }

    const cabecalho = CSS.lastIndexOf('\n\n', inicio);

    return CSS.slice(cabecalho, CSS.indexOf('\n}', inicio));
};

describe('as ligações que são a linha toda', () => {
    const REGRA = bloco();

    it('são as três, e não só a primeira', () => {
        for (const seletor of ONDE) {
            expect(REGRA, `${seletor} ficou de fora`).toContain(seletor);
        }
    });

    /**
     * Em linha, um link não aceita espaço em cima nem em baixo: o
     * `padding-block` é aceite e ignorado, e a caixa continua a ser a
     * altura do texto. Sem esta linha, a regra toda não faz nada.
     */
    it('saem do fluxo em linha, ou o espaço não conta', () => {
        expect(REGRA).toMatch(/display:\s*inline-block/u);
    });

    it('e levam espaço que chegue para um polegar', () => {
        const espaco = /padding-block:\s*(\d+)px/u.exec(REGRA)?.[1];

        expect(espaco, 'falta o padding-block').toBeDefined();
        expect(ALTURA_DO_TEXTO + 2 * Number(espaco)).toBeGreaterThanOrEqual(
            MINIMO,
        );
    });

    /**
     * E não passam da largura da linha.
     *
     * Um `inline-block` não encolhe como o texto que era antes, e o
     * nome de uma crew num telemóvel é precisamente o sítio onde uma
     * palavra comprida empurra a lista para fora do ecrã.
     */
    it('e não empurram a lista para fora do ecrã', () => {
        expect(REGRA).toMatch(/max-width:\s*100%/u);
    });
});

/**
 * E o rótulo de um item da barra de baixo, que não pode partir-se.
 *
 * A barra dava um quarto do ecrã a cada item — noventa e quatro pixéis
 * num telemóvel de 390. "Mine" cabe; "Les miennes" e "As minhas" não, e
 * o rótulo partia-se em duas linhas dentro do botão. Em dois idiomas
 * dos quatro, e em nenhum ecrã em particular: em todos, porque a barra
 * está em todos.
 *
 * A largura passou a sair do conteúdo. O que guarda isso é `nowrap`:
 * sem ele, um rótulo que não caiba volta a partir-se em silêncio em vez
 * de fazer a varredura queixar-se.
 */
describe('os rótulos da barra de baixo', () => {
    const REGRA = CSS.slice(
        CSS.indexOf('\n.barra-baixo a {'),
        CSS.indexOf('\n}', CSS.indexOf('\n.barra-baixo a {')),
    );

    it('não se partem em duas linhas', () => {
        expect(REGRA).toMatch(/white-space:\s*nowrap/u);
    });

    /**
     * E a largura sai do conteúdo. Com `flex: 1` — sem base automática
     * — voltavam a ser quartos iguais, e o rótulo comprido voltava a
     * não caber no quarto dele.
     */
    it('e cada um leva a largura de que precisa', () => {
        expect(REGRA).toMatch(/flex:\s*1\s+1\s+auto/u);
    });
});
