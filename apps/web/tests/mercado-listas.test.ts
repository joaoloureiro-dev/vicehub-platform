import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { CATEGORIAS } from '../src/market/market.api.js';
import { en } from '../src/i18n/en.js';
import { pt } from '../src/i18n/pt.js';
import { es } from '../src/i18n/es.js';
import { fr } from '../src/i18n/fr.js';
import { criarTools } from '../src/i18n/tools.js';

/**
 * As gavetas do mercado, escritas em três sítios.
 *
 * A lista a sério está no package de dados e vai para a base de dados
 * como um tipo do PostgreSQL. A interface não pode importar de lá — o
 * Prisma não entra no browser —, por isso tem uma cópia; e os
 * dicionários têm um nome para cada uma.
 *
 * Três cópias da mesma lista é a receita conhecida: alguém acrescenta
 * uma gaveta de um lado, e do outro ela aparece sem nome ou não aparece
 * de todo. Este teste é a costura que faltava.
 */
const FONTE = path.resolve(
    import.meta.dirname,
    '../../../packages/database/src/market.ts',
);

/** Lê uma lista `export const NOME = [...] as const;` do ficheiro. */
const listaDaFonte = (nome: string): string[] => {
    const ficheiro = readFileSync(FONTE, 'utf8');
    const bloco = new RegExp(
        `export const ${nome} = \\[([^\\]]*)\\]`,
        'u',
    ).exec(ficheiro);

    expect(bloco, `${nome} não está em ${FONTE}`).not.toBeNull();

    return [...(bloco?.[1] ?? '').matchAll(/'([a-z_]+)'/gu)].map(
        (encontrado) => encontrado[1] as string,
    );
};

describe('as listas do mercado', () => {
    it('as categorias da interface são as do package de dados', () => {
        expect([...CATEGORIAS]).toEqual(listaDaFonte('CATEGORIAS_DE_ANUNCIO'));
    });

    it('e cada uma tem nome nos quatro idiomas', () => {
        const dicionarios = [
            en(criarTools('en')),
            pt(criarTools('pt')),
            es(criarTools('es')),
            fr(criarTools('fr')),
        ];

        for (const dicionario of dicionarios) {
            for (const categoria of CATEGORIAS) {
                expect(
                    dicionario.mercado.categorias[categoria],
                    `falta ${categoria}`,
                ).toBeTruthy();
            }
        }
    });

    it('os estados da interface são os do package de dados', () => {
        expect(Object.keys(en(criarTools('en')).mercado.estados)).toEqual(
            listaDaFonte('ESTADOS_DE_ANUNCIO'),
        );
    });
});
