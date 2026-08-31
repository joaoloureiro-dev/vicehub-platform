import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

/**
 * Converte valores BigInt em strings antes da serialização da resposta.
 *
 * O JSON não tem inteiros de precisão arbitrária e o JSON.stringify lança
 * um TypeError perante um BigInt. Como o schema Prisma usa BigInt no xp e
 * no balance, qualquer rota que devolva esses campos falharia com 500.
 *
 * Convertemos para string e não para número: um saldo ou um total de XP
 * pode ultrapassar Number.MAX_SAFE_INTEGER, e a partir daí a conversão
 * para número perde o valor exato de forma silenciosa. Num sistema com
 * economia e transações, isso é inaceitável.
 *
 * A conversão acontece num hook preSerialization e não num serializador
 * de resposta. Um serializador global substituiria a serialização por
 * schema do Fastify, desativando-a sem aviso quando os schemas de
 * resposta forem adicionados. Assim, o payload chega à serialização já
 * sem BigInt e o caminho normal do Fastify mantém-se.
 */

const isPlainObject = (value: object): boolean => {
    const prototype: unknown = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
};

/**
 * Devolve o valor com os BigInt convertidos em string.
 *
 * Quando não existe nenhum BigInt na estrutura, devolve exatamente a
 * mesma referência. Assim a resposta habitual não paga o custo de uma
 * cópia da árvore inteira.
 */
export const convertBigIntToString = (value: unknown): unknown => {
    if (typeof value === 'bigint') {
        return value.toString();
    }

    if (value === null || typeof value !== 'object') {
        return value;
    }

    if (Array.isArray(value)) {
        let changed = false;

        const converted = value.map((item: unknown) => {
            const result = convertBigIntToString(item);

            if (result !== item) {
                changed = true;
            }

            return result;
        });

        return changed ? converted : value;
    }

    /**
     * Datas, Buffers e outras instâncias têm serialização própria e não
     * são percorridas. Só objetos simples são inspecionados, que é o que
     * o Prisma e os nossos DTOs devolvem.
     */
    if (!isPlainObject(value)) {
        return value;
    }

    let changed = false;
    const converted: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
        const result = convertBigIntToString(item);

        if (result !== item) {
            changed = true;
        }

        converted[key] = result;
    }

    return changed ? converted : value;
};

const bigIntSerializationPlugin: FastifyPluginAsync = async (fastify) => {
    fastify.addHook('preSerialization', async (_request, _reply, payload: unknown) =>
        convertBigIntToString(payload),
    );
};

export default fp(bigIntSerializationPlugin, {
    name: 'bigint-serialization-plugin',
});
