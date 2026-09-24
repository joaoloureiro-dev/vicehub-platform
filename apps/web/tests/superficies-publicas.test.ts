import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { OPERATOR } from '../src/legal/operator.js';
import { privacyDocument } from '../src/legal/privacy.document.js';
import { termsDocument } from '../src/legal/terms.document.js';

/**
 * As superfícies onde o público escreve, e o que os documentos dizem
 * sobre elas.
 *
 * Os termos têm uma cláusula que **conta** essas superfícies e diz como
 * é que cada uma é vigiada. Nasceu a dizer que o fórum era a única, e
 * passou a mentir no dia em que o mercado abriu — sem nada falhar,
 * porque nada ligava aquela frase ao código.
 *
 * Este teste é a ligação. A lista a sério está no package de dados, ao
 * lado dos alvos de denúncia: uma superfície onde se escreve é uma
 * superfície que se denuncia. Quando aparecer a terceira — a conversa
 * entre quem compra e quem vende, por exemplo —, isto falha até alguém
 * ir escrevê-la nos documentos.
 */
const FONTE = path.resolve(
    import.meta.dirname,
    '../../../packages/database/src/reports.ts',
);

/** As superfícies, lidas do mapa que diz a que superfície cada alvo pertence. */
const superficiesDaFonte = (): string[] => {
    const ficheiro = readFileSync(FONTE, 'utf8');
    const bloco = /SUPERFICIE_DO_ALVO[^=]*=\s*\{([^}]*)\}/u.exec(ficheiro);

    expect(bloco, `SUPERFICIE_DO_ALVO não está em ${FONTE}`).not.toBeNull();

    const valores = [...(bloco?.[1] ?? '').matchAll(/:\s*'([a-z]+)'/gu)].map(
        (encontrado) => encontrado[1] as string,
    );

    return [...new Set(valores)];
};

/**
 * Como é que os documentos chamam cada superfície, em inglês.
 *
 * Escrito à mão de propósito: `market` não se traduz sozinho para a
 * palavra que um texto legal usa, e uma superfície nova sem entrada
 * aqui faz o teste falhar — que é como se obriga quem a acrescentar a
 * ir escrevê-la nos documentos.
 */
const COMO_OS_DOCUMENTOS_LHE_CHAMAM: Readonly<Record<string, string>> = {
    forum: 'forum',
    market: 'market',
};

/** Os números por extenso, que é como um documento os escreve. */
const POR_EXTENSO = ['no', 'one', 'two', 'three', 'four', 'five'];

const seccaoDosTermos = (heading: string): string => {
    const seccao = termsDocument(OPERATOR).sections.find(
        (uma) => uma.heading === heading,
    );

    expect(seccao, `os termos não têm a secção "${heading}"`).toBeDefined();

    return [...(seccao?.body ?? []), ...(seccao?.list ?? [])].join('\n');
};

const linhasDaPolitica = (): string[] =>
    privacyDocument(OPERATOR).sections.flatMap((seccao) => [
        ...seccao.body,
        ...(seccao.list ?? []),
    ]);

describe('as superfícies onde o público escreve', () => {
    it('os termos contam as que existem', () => {
        const quantas = superficiesDaFonte().length;

        expect(POR_EXTENSO[quantas]).toBeDefined();
        expect(seccaoDosTermos('Reporting, and how we moderate')).toContain(
            `There are ${POR_EXTENSO[quantas]} places on ViceHub`,
        );
    });

    it('e nomeiam cada uma', () => {
        const texto = seccaoDosTermos('Reporting, and how we moderate');

        for (const superficie of superficiesDaFonte()) {
            const nome = COMO_OS_DOCUMENTOS_LHE_CHAMAM[superficie];

            expect(nome, `falta o nome de ${superficie}`).toBeDefined();
            expect(texto).toContain(nome as string);
        }
    });

    /**
     * A política diz que a moderação é feita por pessoas. A frase tem
     * de cobrir as superfícies todas: dizer "do fórum" com um mercado
     * aberto ao lado é uma afirmação a descrever metade do produto.
     */
    it('a política diz que nenhuma é moderada por um programa', () => {
        const frase = linhasDaPolitica().find((linha) =>
            linha.includes('Moderation is done by people'),
        );

        expect(frase).toBeDefined();

        for (const superficie of superficiesDaFonte()) {
            expect(frase).toContain(
                COMO_OS_DOCUMENTOS_LHE_CHAMAM[superficie] as string,
            );
        }
    });

    /**
     * E o inventário de dados tem de dizer que o que se escreve em cada
     * uma delas fica guardado. Uma superfície que falte aqui é texto de
     * uma pessoa que a política não declara.
     */
    it('a política declara o que se escreve em cada uma', () => {
        const frase = linhasDaPolitica().find((linha) =>
            linha.startsWith('What you write in public:'),
        );

        expect(frase).toBeDefined();

        for (const superficie of superficiesDaFonte()) {
            expect(frase).toContain(
                COMO_OS_DOCUMENTOS_LHE_CHAMAM[superficie] as string,
            );
        }
    });
});
