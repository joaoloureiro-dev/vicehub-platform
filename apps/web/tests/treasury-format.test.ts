import { describe, expect, it } from 'vitest';

import {
    MENOS,
    SEPARADOR,
    formatarMontante,
    separadorDoIdioma,
    tamanhoDoSaldo,
} from '../src/treasury/treasury.types.js';

/**
 * A regra que este ficheiro protege: **os montantes nunca passam por
 * `Number`**.
 *
 * São `BigInt` na base de dados e chegam em texto de propósito. Um
 * número de JavaScript deixa de ser exato acima dos nove mil biliões, e
 * num sistema com economia uma unidade perdida numa conversão é uma
 * unidade que ninguém consegue explicar.
 */
const semSeparadores = (valor: string) => valor.split(SEPARADOR).join('');

describe('formatar um montante', () => {
    it('agrupa os milhares', () => {
        expect(formatarMontante('1234567')).toBe(`1${SEPARADOR}234${SEPARADOR}567`);
    });

    it('deixa em paz o que não precisa de agrupar', () => {
        expect(formatarMontante('999')).toBe('999');
        expect(formatarMontante('0')).toBe('0');
    });

    /**
     * O caso que apanha uma conversão para número: acima de
     * Number.MAX_SAFE_INTEGER, o valor deixa de ser representável e
     * qualquer passagem por `Number` altera os últimos dígitos.
     */
    it('não estraga um valor maior do que um número aguenta', () => {
        const enorme = '9007199254740993';

        expect(semSeparadores(formatarMontante(enorme))).toBe(enorme);
        expect(formatarMontante(enorme)).toBe(
            ['9', '007', '199', '254', '740', '993'].join(SEPARADOR),
        );
    });

    it('aguenta o maior montante que a API aceita', () => {
        const maximo = '9'.repeat(19);

        expect(semSeparadores(formatarMontante(maximo))).toBe(maximo);
    });

    it('mantém o sinal de um valor negativo', () => {
        expect(formatarMontante('-4200')).toBe(`${MENOS}4${SEPARADOR}200`);
    });

    /**
     * Preservar os dígitos é a propriedade toda: se um dia alguém puser
     * um `Number` no meio disto, este teste é o que dá o alarme.
     */
    it('devolve exatamente os mesmos dígitos que recebeu', () => {
        for (const valor of [
            '1',
            '12',
            '123',
            '1234',
            '10000000000000001',
            '18446744073709551615',
        ]) {
            expect(semSeparadores(formatarMontante(valor))).toBe(valor);
        }
    });
});

/**
 * Um montante cortado lê-se como outro montante — a pior das saídas.
 * O tamanho do saldo em destaque acompanha o comprimento para que ele
 * caiba sempre por inteiro.
 */
describe('o tamanho do saldo em destaque', () => {
    it('dá o tamanho grande a um valor curto', () => {
        expect(tamanhoDoSaldo('4200')).toContain('40px');
    });

    it('encolhe à medida que o número cresce', () => {
        const curto = tamanhoDoSaldo('4200');
        const medio = tamanhoDoSaldo('1234567890');
        const enorme = tamanhoDoSaldo('9'.repeat(19));

        expect(new Set([curto, medio, enorme]).size).toBe(3);
    });

    it('nunca deixa o maior montante no tamanho grande', () => {
        expect(tamanhoDoSaldo('9'.repeat(19))).not.toContain('40px');
    });
});

/**
 * O separador muda de idioma para idioma — e é a única coisa que muda.
 * Os dígitos continuam a ser os que vieram: o montante nunca passa por
 * `Number`, seja qual for o idioma.
 */
describe('o separador de cada idioma', () => {
    it('vírgula em inglês, ponto em português e em espanhol', () => {
        expect(separadorDoIdioma('en')).toBe(',');
        expect(separadorDoIdioma('pt')).toBe('.');
        expect(separadorDoIdioma('es')).toBe('.');
    });

    /**
     * O francês agrupa com um espaço — e é um espaço fino inquebrável,
     * não o espaço da barra. Vem do `Intl` precisamente para não ser
     * adivinhado.
     */
    it('um espaço inquebrável em francês', () => {
        const separador = separadorDoIdioma('fr');

        expect(separador.trim()).toBe('');
        expect(separador).not.toBe(' ');
    });

    /**
     * O espanhol não agrupa números de quatro dígitos. Se a amostra
     * usada para descobrir o separador fosse mil, não haveria separador
     * nenhum para ler e o espanhol caía no valor por omissão.
     */
    it('descobre o separador mesmo onde mil não é agrupado', () => {
        expect(separadorDoIdioma('es')).not.toBe(SEPARADOR);
    });

    it('agrupa com o separador que lhe derem', () => {
        expect(formatarMontante('1234567', ',')).toBe('1,234,567');
        expect(formatarMontante('1234567', '.')).toBe('1.234.567');
    });

    it('preserva os dígitos em qualquer idioma', () => {
        const enorme = '9007199254740993';

        for (const idioma of ['en', 'pt', 'es', 'fr']) {
            const separador = separadorDoIdioma(idioma);

            expect(
                formatarMontante(enorme, separador).split(separador).join(''),
            ).toBe(enorme);
        }
    });
});
