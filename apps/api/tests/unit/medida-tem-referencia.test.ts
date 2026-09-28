import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Cada ecrã medido tem um número gravado ao lado.
 *
 * `scripts/medir.mjs` conta as consultas que cada ecrã custa à base de
 * dados e queixa-se do que cresceu. A queixa só existe por comparação:
 * um ecrã sem referência passa sempre, custe o que custar — e um ecrã
 * acrescentado à lista sem se gravar a referência é precisamente um
 * ecrã que ninguém volta a medir.
 *
 * Este teste não corre a medição, que precisa de uma API de pé. Lê as
 * duas listas e exige que batam certo.
 */
const RAIZ = join(import.meta.dirname, '../..');

const MEDIR = readFileSync(join(RAIZ, 'scripts/medir.mjs'), 'utf8');

const BASE = JSON.parse(
    readFileSync(join(RAIZ, 'scripts/medir-base.json'), 'utf8'),
) as Record<string, number>;

/**
 * Os nomes que a medição usa, lidos da própria lista.
 *
 * O bloco `const ECRAS = [` até ao fecho, e de cada linha o primeiro
 * texto entre plicas — que é como a lista está escrita.
 */
const ecrasMedidos = (): string[] => {
    const inicio = MEDIR.indexOf('const ECRAS = [');
    const fim = MEDIR.indexOf('\n];', inicio);

    if (inicio === -1 || fim === -1) {
        throw new Error('não encontrei a lista de ecrãs em medir.mjs.');
    }

    return [...MEDIR.slice(inicio, fim).matchAll(/^\s*\['([^']+)'/gmu)].map(
        (linha) => linha[1] as string,
    );
};

describe('a medição de consultas', () => {
    const ECRAS = ecrasMedidos();

    it('mede alguma coisa', () => {
        expect(ECRAS.length).toBeGreaterThan(10);
    });

    it('e cada ecrã tem uma referência gravada', () => {
        const semReferencia = ECRAS.filter((nome) => BASE[nome] === undefined);

        expect(semReferencia).toEqual([]);
    });

    /**
     * E ao contrário: uma referência de um ecrã que já não se mede é um
     * número que ninguém compara com nada.
     */
    it('e não guarda referências de ecrãs que já não mede', () => {
        const aSobrar = Object.keys(BASE).filter(
            (nome) => !ECRAS.includes(nome),
        );

        expect(aSobrar).toEqual([]);
    });

    /**
     * A referência mede-se com várias comunidades de propósito.
     *
     * Com uma só, um pedido que faz duas consultas **por comunidade**
     * custa quase o mesmo que um que faz duas ao todo — foi assim que
     * um N+1 na caixa do que espera resposta passou despercebido. O
     * número está no ficheiro com a razão ao lado; aqui guarda-se que
     * não volte a um.
     */
    it('e monta mais do que uma comunidade para o medir', () => {
        const quantas = /const COMUNIDADES = (\d+)/u.exec(MEDIR)?.[1];

        expect(Number(quantas)).toBeGreaterThan(1);
    });
});
