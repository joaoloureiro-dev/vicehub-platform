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
 * Este ficheiro guarda o caso que ela apanhou: **as ligações dentro de
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

const bloco = (seletor: string): string => {
    const inicio = CSS.indexOf(`\n${seletor} {`);

    if (inicio === -1) {
        throw new Error(`a folha não tem uma regra para ${seletor}.`);
    }

    return CSS.slice(inicio, CSS.indexOf('\n}', inicio));
};

describe('as ligações numa lista de pessoas', () => {
    const REGRA = bloco('.pessoas .nome a');

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
