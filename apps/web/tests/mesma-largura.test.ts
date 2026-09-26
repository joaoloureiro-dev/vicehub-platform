import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Duas listas do mesmo género, com a mesma largura.
 *
 * A passagem a 1280 mediu, por ecrã, quanto do painel é que o conteúdo
 * usa. A fila de quem modera usava **49%**: uma coluna de 440 pixéis no
 * meio de 900, com metade da página vazia ao lado — e a caixa de
 * avisos, que é a mesma coisa (uma lista de cartões que se lê e se
 * decide), usava 93%.
 *
 * A regra já existia e chamava-se `.mercado`, que era o sítio onde o
 * problema apareceu primeiro. Um nome que é o primeiro caso da regra
 * mente à quarta página que precisa dela e não é mercado nenhum.
 *
 * E a largura da **coluna** não é a largura da **linha**: o texto lá
 * dentro continua a levar a medida. Uma coluna larga é para a lista
 * caber, e não para a linha crescer com ela.
 */
const RAIZ = path.resolve(import.meta.dirname, '..');

const CSS = readFileSync(path.join(RAIZ, 'src/styles/theme.css'), 'utf8');

const regra = (seletor: string): string => {
    const inicio = CSS.indexOf(`${seletor} {`);

    expect(inicio, `regra ${seletor} não existe`).toBeGreaterThan(-1);

    return CSS.slice(inicio, CSS.indexOf('}', inicio));
};

const ficheiros = (pasta: string): string[] =>
    readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
        const caminho = path.join(pasta, entrada.name);

        if (entrada.isDirectory()) {
            return ficheiros(caminho);
        }

        return /\.tsx?$/u.test(entrada.name) ? [caminho] : [];
    });

/** Os ecrãs que são uma lista do que as pessoas escreveram. */
const LISTAS = [
    'src/moderation/pages/fila.page.tsx',
    'src/notifications/pages/avisos.page.tsx',
    'src/market/pages/mercado.page.tsx',
    'src/market/pages/conversas.page.tsx',
    'src/market/pages/conversa.page.tsx',
    'src/forum/pages/topic.page.tsx',
];

describe('as páginas que são listas', () => {
    it.each(LISTAS)('%s usa a largura toda', (ecra) => {
        expect(readFileSync(path.join(RAIZ, ecra), 'utf8')).toContain(
            'panel wide esticado',
        );
    });

    /**
     * Era `> .card`, filho directo, e o cabeçalho da fila esticava-se
     * enquanto os cartões das denúncias — que vivem dentro de um `ul` —
     * ficavam nos 440. Duas larguras na mesma página é precisamente o
     * que esta regra existe para não deixar acontecer.
     */
    it('e os cartões lá dentro acompanham, a qualquer profundidade', () => {
        expect(regra('.panel.esticado .card')).toContain('max-width: none');
        expect(CSS).not.toContain('.panel.esticado > .card');
    });

    /** A largura da coluna não é a largura da linha. */
    it('mas o texto lá dentro continua a ter a medida', () => {
        expect(regra('.texto')).toContain('max-width: var(--medida)');
    });

    /**
     * O nome diz a regra e não o primeiro caso dela. Enquanto se
     * chamou `.mercado`, a fila de denúncias não a adoptou — e ficou
     * dois dias a 440 ao lado de uma lista igual a 836.
     */
    it('e a classe não tem o nome da página onde nasceu', () => {
        const presos = ficheiros(path.join(RAIZ, 'src')).filter((caminho) =>
            readFileSync(caminho, 'utf8').includes('panel wide mercado'),
        );

        expect(presos).toEqual([]);
        expect(CSS).not.toContain('.panel.mercado');
    });
});
