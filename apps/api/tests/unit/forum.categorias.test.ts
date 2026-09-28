import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CATEGORIAS_DO_FORUM, CATEGORIA_POR_OMISSAO } from '@vicehub/database';

import {
    createTopicSchema,
    listTopicsQuerySchema,
} from '../../src/modules/forum/schemas/forum.schemas.js';

/**
 * **As categorias do fórum estão escritas em dois sítios, e têm de dizer
 * o mesmo.**
 *
 * Uma é a lista em código, que o esquema de entrada valida e o ecrã
 * traduz; a outra é o tipo `ForumCategory` do Postgres, que é quem
 * recusa mesmo. Não há maneira de as gerar uma a partir da outra — o
 * tipo da base nasce numa migração escrita à mão —, por isso a
 * alternativa a este teste é descobrir a diferença quando um tópico
 * novo é recusado pela base com um erro que ninguém sabe ler.
 *
 * A ordem também conta, e não só o conjunto: é por ela que as
 * categorias aparecem no ecrã, e é a primeira que recebe as perguntas
 * de quem não escolhe.
 */
const ESQUEMA = readFileSync(
    join(import.meta.dirname, '../../../../packages/database/prisma/schema.prisma'),
    'utf8',
);

const enumDoEsquema = (nome: string): string[] => {
    const bloco = new RegExp(`enum ${nome} \\{([^}]*)\\}`).exec(ESQUEMA);

    if (bloco?.[1] === undefined) {
        throw new Error(`O esquema não tem um enum ${nome}.`);
    }

    return bloco[1]
        .split('\n')
        .map((linha) => linha.replace(/\/\/.*$/, '').trim())
        .filter((linha) => linha !== '');
};

describe('as categorias do fórum', () => {
    it('são as mesmas no código e no Postgres, pela mesma ordem', () => {
        expect(enumDoEsquema('ForumCategory')).toEqual([
            ...CATEGORIAS_DO_FORUM,
        ]);
    });

    /**
     * E a omissão é uma delas. Uma omissão fora da lista passava a
     * validação do esquema de entrada e era recusada pela base — o pior
     * sítio para descobrir um erro de escrita.
     */
    it('e a omissão é uma categoria que existe', () => {
        expect(CATEGORIAS_DO_FORUM).toContain(CATEGORIA_POR_OMISSAO);
    });

    /**
     * A omissão da base de dados é a mesma do código.
     *
     * Duas omissões diferentes são duas respostas à mesma pergunta, e
     * qual delas ganha depende do caminho por onde o tópico entre: pela
     * API, a do esquema de entrada; por uma inserção directa ou por uma
     * sementeira, a da coluna.
     */
    it('e a omissão da coluna é a mesma do código', () => {
        const coluna = /category\s+ForumCategory\s+@default\((\w+)\)/.exec(ESQUEMA);

        expect(coluna?.[1]).toBe(CATEGORIA_POR_OMISSAO);
    });
});

describe('o que entra num tópico novo', () => {
    const pergunta = {
        title: 'Como é que se abre a tesouraria de uma crew?',
        body: 'Já somos oito e ninguém encontra o botão. Onde é?',
    };

    it('aceita uma categoria da lista', () => {
        const lido = createTopicSchema.parse({
            ...pergunta,
            category: 'servers',
        });

        expect(lido.category).toBe('servers');
    });

    /**
     * Um cliente que não saiba de categorias continua a poder
     * perguntar. A pergunta cai na conversa geral, que é melhor do que
     * uma recusa por um campo que quem escreveu nunca viu.
     */
    it('e sem categoria nenhuma cai na do costume', () => {
        expect(createTopicSchema.parse(pergunta).category).toBe(
            CATEGORIA_POR_OMISSAO,
        );
    });

    it('e recusa uma categoria que não existe', () => {
        expect(() =>
            createTopicSchema.parse({ ...pergunta, category: 'memes' }),
        ).toThrow();
    });
});

describe('o que entra numa lista de tópicos', () => {
    /**
     * Sem categoria, a lista é o fórum todo.
     *
     * Uma omissão aqui — ao contrário do tópico novo — escondia quatro
     * quintos do fórum a quem nunca pediu para o filtrar.
     */
    it('sem categoria, não filtra nada', () => {
        expect(listTopicsQuerySchema.parse({}).category).toBeUndefined();
    });

    it('e com uma, filtra por ela', () => {
        expect(listTopicsQuerySchema.parse({ category: 'crews' }).category).toBe(
            'crews',
        );
    });

    it('e recusa uma que não existe', () => {
        expect(() => listTopicsQuerySchema.parse({ category: 'memes' })).toThrow();
    });
});
