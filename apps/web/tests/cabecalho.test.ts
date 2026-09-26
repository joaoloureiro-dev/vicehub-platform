import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * O que cabe na barra de cima de um telemóvel.
 *
 * A barra de quem tem sessão ganhou mais um item — os avisos — e deixou
 * de caber em 390px: a **página inteira** passou a arrastar-se de lado,
 * em todos os ecrãs, por causa de noventa pixéis de palavra. Não foi
 * nenhum teste que o apanhou; foi olhar para o ecrã.
 *
 * A palavra que saiu foi o nome do sítio, que é o que menos diz a quem
 * já lá está dentro. O logótipo fica, e continua a levar a casa.
 *
 * Isto guarda as duas metades: sai no telemóvel, volta quando há
 * largura. Uma regra de CSS sem teste desaparece na primeira limpeza
 * que alguém fizer.
 */
const CSS = readFileSync(
    path.resolve(import.meta.dirname, '../src/styles/theme.css'),
    'utf8',
);

/** Todos os corpos de regra com este seletor exato, pela ordem do ficheiro. */
const regras = (seletor: string): string[] => {
    const corpos: string[] = [];

    let procura = CSS.indexOf(`${seletor} {`);

    while (procura > -1) {
        corpos.push(CSS.slice(procura, CSS.indexOf('}', procura)));
        procura = CSS.indexOf(`${seletor} {`, procura + 1);
    }

    expect(corpos.length, `regra ${seletor} não existe`).toBeGreaterThan(0);

    return corpos;
};

describe('o cabeçalho no telemóvel', () => {
    it('não mostra o nome do sítio', () => {
        expect(regras('.brand strong')[0]).toContain('display: none');
    });

    /**
     * A outra metade, e a que se perde primeiro: num portátil há
     * largura de sobra e o nome é a marca. Sem este caso, alguém
     * "arrumava" a regra e o nome desaparecia do produto inteiro.
     */
    it('mas mostra-o assim que há largura', () => {
        const [, comLargura] = regras('.brand strong');

        expect(comLargura, 'falta a regra que o traz de volta').toBeDefined();
        expect(comLargura).toContain('display: inline');

        /** E dentro de uma media query, que é o que a torna condicional. */
        const media = CSS.lastIndexOf(
            '@media',
            CSS.indexOf('.brand strong {', CSS.indexOf('.brand strong {') + 1),
        );

        expect(CSS.slice(media, media + 30)).toContain('min-width');
    });

    /**
     * O logótipo nunca sai. É o que resta a dizer onde a pessoa está, e
     * uma barra que começa por um botão de sair sem nada à esquerda não
     * é um sítio — é um formulário.
     */
    it('e nunca esconde o logótipo', () => {
        for (const corpo of regras('.brand img')) {
            expect(corpo).not.toContain('display: none');
        }
    });
});
