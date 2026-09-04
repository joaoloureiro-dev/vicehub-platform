import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A outra metade da garantia dos dicionários.
 *
 * O TypeScript já impede uma chave **em falta**: o inglês é a fonte de
 * verdade e os outros três são tipados contra ele. O que ele não vê é
 * uma chave que **já ninguém usa** — uma tradução para um ecrã que foi
 * apagado fica lá, é traduzida para quatro idiomas de cada vez que
 * alguém passa por ela, e não aparece a lado nenhum.
 *
 * Este teste lê o dicionário inglês e o código que o consome, e falha
 * quando uma chave deixa de ter quem a use.
 */

const raiz = join(import.meta.dirname, '..');

/**
 * Secções lidas por índice, e não por nome.
 *
 * `t.cargos[papel]` e `t.categorias[valor]` resolvem a chave em execução
 * a partir do que a API devolveu. Procurar `t.cargos.crew_leader` no
 * código não encontraria nada, e apagar essa chave partia o ecrã — por
 * isso ficam de fora.
 */
const POR_INDICE = new Set([
    'cargos',
    'categorias',
    'estadosMovimento',
    'estadosEvento',
    'participacao',
    'bases',
    'nav',
]);

const DICIONARIOS = new Set(['en.ts', 'pt.ts', 'es.ts', 'fr.ts']);

const lerFicheiros = (pasta: string): string[] =>
    readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
        const caminho = join(pasta, entrada.name);

        if (entrada.isDirectory()) {
            return lerFicheiros(caminho);
        }

        /*
         * Os dicionários não contam como uso de si próprios — mas o
         * resto do que vive em `i18n/` conta: o seletor de idioma é um
         * componente como os outros, e excluir a pasta inteira fazia
         * este teste acusar a chave que ele usa.
         */
        if (DICIONARIOS.has(entrada.name)) {
            return [];
        }

        return /\.tsx?$/.test(entrada.name) ? [readFileSync(caminho, 'utf8')] : [];
    });

const caminhosDoDicionario = (fonte: string): string[] => {
    const caminhos: string[] = [];
    let seccao: string | null = null;

    for (const linha of fonte.split('\n')) {
        const inicioDeSeccao = /^ {4}(\w+): \{/.exec(linha);

        if (inicioDeSeccao?.[1]) {
            seccao = inicioDeSeccao[1];
            continue;
        }

        const chave = /^ {8}(\w+):/.exec(linha);

        if (chave?.[1] && seccao && !POR_INDICE.has(seccao)) {
            caminhos.push(`${seccao}.${chave[1]}`);
        }
    }

    return caminhos;
};

describe('o dicionário não guarda chaves que ninguém usa', () => {
    it('todas as chaves do inglês têm quem as leia', () => {
        const dicionario = readFileSync(join(raiz, 'src/i18n/en.ts'), 'utf8');
        const codigo = lerFicheiros(join(raiz, 'src')).join('\n');

        const orfas = caminhosDoDicionario(dicionario).filter(
            (caminho) => !codigo.includes(`.${caminho}`),
        );

        expect(orfas).toEqual([]);
    });

    /**
     * Uma salvaguarda para o próprio teste: se a leitura falhasse e não
     * encontrasse chave nenhuma, ele passava sempre e não protegia nada.
     */
    it('encontra mesmo as chaves que diz verificar', () => {
        const dicionario = readFileSync(join(raiz, 'src/i18n/en.ts'), 'utf8');

        expect(caminhosDoDicionario(dicionario).length).toBeGreaterThan(100);
    });
});
