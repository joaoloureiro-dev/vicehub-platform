import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * O tamanho do que se carrega.
 *
 * Uma passagem pelo produto inteiro num telemóvel mediu todos os
 * botões e ligações de cada ecrã. O que apareceu não foi um ecrã
 * partido: foi um padrão — as ligações do cabeçalho, do rodapé e as de
 * voltar tinham a altura que o tipo de letra lhes dá, vinte e dois
 * pixéis, e vinte e dois é menos do que um dedo acerta sem falhar.
 *
 * São duas medidas e não duas grafias da mesma: um controlo ocupa uma
 * faixa do ecrã e leva os 48 de `--tap`; uma ligação vive dentro de
 * uma linha de texto, e 48 rasgavam o parágrafo à volta dela.
 */
const CSS = readFileSync(
    path.resolve(import.meta.dirname, '../src/styles/theme.css'),
    'utf8',
);

const regra = (seletor: string): string => {
    const inicio = CSS.indexOf(`${seletor} {`);

    expect(inicio, `regra ${seletor} não existe`).toBeGreaterThan(-1);

    return CSS.slice(inicio, CSS.indexOf('}', inicio));
};

/** O valor de uma variável do `:root`, em pixéis. */
const medida = (nome: string): number => {
    const encontrado = new RegExp(`${nome}:\\s*(\\d+)px`, 'u').exec(CSS);

    expect(encontrado, `${nome} não está definida`).not.toBeNull();

    return Number(encontrado?.[1]);
};

describe('o que se carrega num telemóvel', () => {
    /**
     * Vinte e quatro é o chão das normas de acessibilidade, e é pouco:
     * o que aqui se guarda é que a medida existe e que **não desce**
     * abaixo dele numa arrumação distraída.
     */
    it('tem uma medida só, e ela chega para um dedo', () => {
        expect(medida('--tap-ligacao')).toBeGreaterThanOrEqual(24);
    });

    /** E a dos controlos continua a ser maior, que é a outra regra. */
    it('e os controlos continuam a levar a medida maior', () => {
        expect(medida('--tap')).toBeGreaterThan(medida('--tap-ligacao'));
    });

    it.each([
        ['.topbar nav a,\n.topbar nav > button', 'o cabeçalho'],
        ['.rodape a', 'o rodapé'],
        ['.ligacao-solta', 'as ligações sozinhas no seu bloco'],
    ])('%s leva a medida', (seletor) => {
        expect(regra(seletor)).toContain('min-height: var(--tap-ligacao)');
    });

    /**
     * O nome da classe diz a regra, e não um dos casos dela. Chamava-se
     * `.voltar` e à terceira ligação que não voltava a lado nenhum — o
     * "abrir" de uma denúncia — o nome passava a mentir.
     */
    it('e a classe chama-se pela regra, não pelo primeiro caso', () => {
        expect(CSS).not.toContain('.voltar {');
    });
});

/**
 * Havia duas classes iguais com nomes diferentes para o texto que só se
 * ouve. A segunda nasceu porque quem precisou dela não deu pela
 * primeira — e duas grafias da mesma regra acabam com metade dos ecrãs
 * a esquecer-se de uma delas.
 */
describe('o texto que só se ouve', () => {
    it('tem uma classe só', () => {
        expect(CSS).toContain('.sr-only {');
        expect(CSS).not.toContain('.visually-hidden {');
    });

    /**
     * E nenhum ecrã ficou a pedir a que saiu. Sem isto, apagar a regra
     * do CSS deixava um `className` a apontar para nada — texto que
     * devia estar escondido a aparecer no meio da página.
     */
    it('e nenhum ecrã ficou a pedir a que saiu', () => {
        const emQueFicheiros: string[] = [];

        const percorrer = (pasta: string): void => {
            for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
                const caminho = path.join(pasta, entrada.name);

                if (entrada.isDirectory()) {
                    percorrer(caminho);
                } else if (/\.tsx?$/u.test(entrada.name)) {
                    if (readFileSync(caminho, 'utf8').includes('visually-hidden')) {
                        emQueFicheiros.push(caminho);
                    }
                }
            }
        };

        percorrer(path.resolve(import.meta.dirname, '../src'));

        expect(emQueFicheiros).toEqual([]);
    });
});
