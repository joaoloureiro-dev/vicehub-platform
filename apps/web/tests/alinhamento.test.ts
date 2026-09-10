import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Onde cada tipo de página começa.
 *
 * O `main` centra verticalmente o que lá está. Isso serve uma caixa de
 * início de sessão — uma caixa pequena a meio do ecrã lê-se bem — e
 * estraga uma página de conteúdo: um perfil com poucas linhas ficava a
 * flutuar a quatrocentos pixéis do topo, com um vazio por cima que
 * parece uma avaria.
 *
 * A distinção já existia na marcação (`panel` é formulário, `panel wide`
 * é conteúdo) e faltava dizê-la ao alinhamento. Isto guarda as duas
 * metades da decisão, porque uma regra de CSS sem teste desaparece na
 * primeira limpeza que alguém fizer.
 */
const CSS = readFileSync(
    path.resolve(import.meta.dirname, '../src/styles/theme.css'),
    'utf8',
);

/** O corpo de uma regra, pelo seletor exato. */
const regra = (seletor: string): string => {
    const inicio = CSS.indexOf(`${seletor} {`);

    expect(inicio, `regra ${seletor} não existe`).toBeGreaterThan(-1);

    return CSS.slice(inicio, CSS.indexOf('}', inicio));
};

describe('o alinhamento das páginas', () => {
    it('põe o conteúdo a começar em cima', () => {
        expect(regra('.panel.wide')).toContain('align-self: flex-start');
    });

    it('e a landing também, que é conteúdo e não passa por panel', () => {
        expect(regra('.landing')).toContain('align-self: flex-start');
    });

    /**
     * A outra metade, e a que se perde primeiro: um formulário continua
     * centrado. Sem este caso, alguém "arrumava" a regra para o `.panel`
     * inteiro e a caixa de login ia parar ao topo do ecrã.
     */
    it('mas deixa os formulários centrados', () => {
        const inicio = CSS.indexOf('.panel {');

        expect(inicio).toBeGreaterThan(-1);

        expect(CSS.slice(inicio, CSS.indexOf('}', inicio))).not.toContain(
            'align-self',
        );
    });

    /** E o `main` continua a ser quem centra, ou nada disto faz sentido. */
    it('o main continua a centrar o que não disser o contrário', () => {
        expect(regra('main')).toContain('align-items: safe center');
    });
});
