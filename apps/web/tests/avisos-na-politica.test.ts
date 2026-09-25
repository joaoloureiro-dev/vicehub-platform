import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { OPERATOR } from '../src/legal/operator.js';
import { privacyDocument } from '../src/legal/privacy.document.js';

/**
 * Os avisos, e o que a política tem de dizer sobre eles.
 *
 * Um aviso é um registo novo sobre uma pessoa: que alguém lhe falou,
 * quem foi, e se ela já leu. Não é texto que ela escreveu — é a
 * plataforma a guardar uma coisa **acerca** dela —, e por isso entra no
 * inventário como qualquer outro.
 *
 * Este teste é do mesmo tipo que o das superfícies onde o público
 * escreve, e existe pela mesma razão: uma espécie de aviso nova sem uma
 * linha na política é um dado guardado que a política não declara, e
 * nada no código a obrigaria a falhar.
 */
const FONTE = path.resolve(
    import.meta.dirname,
    '../../../packages/database/src/notifications.ts',
);

const especiesDaFonte = (): string[] => {
    const ficheiro = readFileSync(FONTE, 'utf8');
    const encontrado = /ESPECIES_DE_AVISO[^=]*=\s*\[([^\]]*)\]/u.exec(ficheiro);

    expect(encontrado, `ESPECIES_DE_AVISO não está em ${FONTE}`).not.toBeNull();

    return [...(encontrado?.[1] ?? '').matchAll(/'([a-z_]+)'/gu)].map(
        (uma) => uma[1] as string,
    );
};

/**
 * Como é que a política chama aquilo a que cada espécie aponta.
 *
 * Escrito à mão de propósito, como os nomes das superfícies: uma
 * espécie nova sem entrada aqui faz o teste falhar, que é como se
 * obriga quem a acrescentar a ir escrevê-la no documento.
 */
const A_QUE_APONTA: Readonly<Record<string, string>> = {
    market_message: 'message',
    forum_reply: 'reply',
    market_review: 'review',
    market_review_reply: 'review',
};

const linhaDoInventario = (): string => {
    const inventario = privacyDocument(OPERATOR).sections.find(
        (uma) => uma.heading === 'What we store',
    );

    expect(inventario).toBeDefined();

    const linha = [...(inventario?.list ?? [])].find((uma) =>
        uma.startsWith('Notifications:'),
    );

    expect(
        linha,
        'o inventário da política não tem linha nenhuma sobre os avisos',
    ).toBeDefined();

    return linha ?? '';
};

describe('os avisos na política de privacidade', () => {
    it('estão declarados no inventário', () => {
        expect(linhaDoInventario().length).toBeGreaterThan(0);
    });

    /**
     * Uma linha que diga "notificações" e mais nada não declara nada: o
     * que interessa a quem lê é **a que é que um aviso aponta**, porque
     * é isso que fica guardado ao lado do nome de quem o causou.
     */
    it('e a linha diz a que aponta cada espécie', () => {
        const linha = linhaDoInventario().toLowerCase();

        for (const especie of especiesDaFonte()) {
            const nome = A_QUE_APONTA[especie];

            expect(nome, `falta o nome do alvo de ${especie}`).toBeDefined();
            expect(
                linha,
                `a linha não fala do que ${especie} aponta`,
            ).toContain(nome as string);
        }
    });

    /**
     * E as duas coisas que um aviso guarda para além do alvo: **quem o
     * causou** e **se já foi lido**. A segunda é a que se esquece, e é
     * a que faz a diferença entre um registo de um acontecimento e um
     * registo de um comportamento.
     */
    it('e diz que guarda quem o causou e se já foi lido', () => {
        const linha = linhaDoInventario().toLowerCase();

        expect(linha).toContain('who it was');
        /**
         * A palavra inteira, e não a sequência de letras: "already"
         * contém "read", e um teste que a aceitasse dava por escrita
         * uma frase que tinha sido apagada. Um mutante mostrou-o.
         */
        expect(linha).toMatch(/\bread\b/u);
    });

    /**
     * A caixa de avisos diz, no ecrã, que nada dali é enviado por
     * email. A política tem de dizer o mesmo: uma pessoa que leia que
     * há avisos e não leia isto tem razão em supor que lhe chegam à
     * caixa de correio.
     */
    it('e que nada disto sai da plataforma', () => {
        const linha = linhaDoInventario().toLowerCase();

        expect(linha).toContain('no email');
    });
});
