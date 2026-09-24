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

/** Todas as superfícies onde alguém escreve, públicas e privadas. */
const superficiesDaFonte = (): string[] => bloco('SUPERFICIES');

/**
 * E as públicas, que são as que os termos contam.
 *
 * A distinção é o que este teste tem de respeitar: uma conversa privada
 * **não** é um sítio onde toda a gente lê, e exigir que os termos a
 * contassem como tal era obrigá-los a escrever uma frase falsa.
 */
const publicasDaFonte = (): string[] =>
    Object.entries(quemLeDaFonte())
        .filter(([, quem]) => quem === 'todos')
        .map(([superficie]) => superficie);

const bloco = (nome: string): string[] => {
    const ficheiro = readFileSync(FONTE, 'utf8');
    const encontrado = new RegExp(
        `${nome}[^=]*=\\s*\\[([^\\]]*)\\]`,
        'u',
    ).exec(ficheiro);

    expect(encontrado, `${nome} não está em ${FONTE}`).not.toBeNull();

    return [...(encontrado?.[1] ?? '').matchAll(/'([a-z]+)'/gu)].map(
        (um) => um[1] as string,
    );
};

const quemLeDaFonte = (): Record<string, string> => {
    const ficheiro = readFileSync(FONTE, 'utf8');
    const encontrado = /QUEM_LE[^{]*\{([^}]*)\}/u.exec(ficheiro);

    expect(encontrado, `QUEM_LE não está em ${FONTE}`).not.toBeNull();

    return Object.fromEntries(
        [
            ...(encontrado?.[1] ?? '').matchAll(
                /([a-z]+):\s*'([a-z ]+)'/gu,
            ),
        ].map((um) => [um[1] as string, um[2] as string]),
    );
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
    messages: 'messages',
    reviews: 'review',
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
    it('os termos contam as públicas', () => {
        const quantas = publicasDaFonte().length;

        expect(POR_EXTENSO[quantas]).toBeDefined();
        expect(seccaoDosTermos('Reporting, and how we moderate')).toContain(
            `There are ${POR_EXTENSO[quantas]} places on ViceHub`,
        );
    });

    /**
     * E a secção nomeia **todas**, públicas e privadas: uma superfície
     * que não apareça ali é um sítio onde se escreve e que os termos
     * não dizem como é vigiado.
     */
    it('e nomeiam cada uma, pública ou não', () => {
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
        /**
         * O inventário inteiro, e não uma frase dele: o que é público
         * cabe numa linha, e uma conversa privada tem a sua — juntá-las
         * à força era escrever que uma mensagem é pública.
         */
        const inventario = privacyDocument(OPERATOR).sections.find(
            (uma) => uma.heading === 'What we store',
        );

        expect(inventario).toBeDefined();

        const texto = [
            ...(inventario?.body ?? []),
            ...(inventario?.list ?? []),
        ].join('\n');

        for (const superficie of superficiesDaFonte()) {
            expect(
                texto,
                `o inventário não fala de ${superficie}`,
            ).toContain(COMO_OS_DOCUMENTOS_LHE_CHAMAM[superficie] as string);
        }
    });
});

/**
 * O que uma conversa privada obriga a política a dizer.
 *
 * Não é uma superfície como as outras: o que lá se escreve não é lido
 * por toda a gente, e a política tem de dizer **por quem é**. Sem esta
 * secção, uma pessoa escrevia sem saber que uma denúncia leva a sua
 * mensagem a um moderador.
 */
describe('as superfícies privadas', () => {
    it('existem, e a política tem uma secção sobre quem as lê', () => {
        expect(
            Object.values(quemLeDaFonte()).some((quem) => quem !== 'todos'),
        ).toBe(true);

        const seccao = privacyDocument(OPERATOR).sections.find(
            (uma) => uma.heading === 'Who reads your messages',
        );

        expect(seccao).toBeDefined();
    });

    /**
     * Nomear não chega: os termos têm de dizer **o que é diferente**
     * numa superfície privada. Um mutante mostrou-o — apagar a frase
     * sobre as conversas não partia nada, porque a palavra continuava
     * a aparecer noutro sítio da mesma secção.
     */
    it('os termos dizem quem denuncia nelas', () => {
        const seccao = termsDocument(OPERATOR).sections.find(
            (uma) => uma.heading === 'Reporting, and how we moderate',
        );

        const linhas = [...(seccao?.body ?? []), ...(seccao?.list ?? [])];

        for (const superficie of superficiesDaFonte()) {
            if (quemLeDaFonte()[superficie] === 'todos') {
                continue;
            }

            const nome = COMO_OS_DOCUMENTOS_LHE_CHAMAM[superficie] as string;

            /**
             * Nome, "only" e "report" na mesma frase.
             *
             * Não é a redação que se prende — é a regra: numa
             * superfície privada, **só** quem lá está **denuncia**.
             * Uma frase que diga isso por outras palavras passa; uma
             * secção que deixe de o dizer, não.
             */
            expect(
                linhas.some((linha) => {
                    /** Sem maiúsculas: a frase pode começar pelo nome. */
                    const minusculas = linha.toLowerCase();

                    return (
                        minusculas.includes(nome)
                        && minusculas.includes('only')
                        && minusculas.includes('report')
                    );
                }),
                `os termos não dizem quem denuncia em ${superficie}`,
            ).toBe(true);
        }
    });

    it('e diz que só a mensagem denunciada sai da conversa', () => {
        const seccao = privacyDocument(OPERATOR).sections.find(
            (uma) => uma.heading === 'Who reads your messages',
        );

        const texto = [
            ...(seccao?.body ?? []),
            ...(seccao?.list ?? []),
        ].join('\n');

        expect(texto).toContain('If one of you reports a message');
        expect(texto).toContain('Not the conversation around it');
    });
});
