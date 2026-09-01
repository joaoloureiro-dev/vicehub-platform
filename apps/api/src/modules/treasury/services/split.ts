/**
 * Cálculo de uma divisão de ganhos.
 *
 * Fica numa função pura, separada do resto do serviço, porque é a parte
 * que decide quanto cada pessoa recebe — e a que mais vale a pena poder
 * testar sozinha, sem base de dados nem HTTP pelo meio.
 */

export interface SplitShare {
    userId: string;
    amount: bigint;
}

/**
 * Divide um total em partes iguais.
 *
 * A divisão inteira quase nunca é exata: dividir 100 por 3 dá 33 a cada
 * um e sobra 1. Esse resto **não pode ficar perdido** — a soma das partes
 * tem de dar exatamente o total, senão a tesouraria fica com dinheiro que
 * ninguém sabe explicar, e ao fim de muitas divisões a diferença cresce.
 *
 * O resto é repartido em unidades inteiras pelos primeiros da lista. Quem
 * chama ordena os membros por antiguidade, pelo que a unidade extra fica
 * para quem está na crew há mais tempo — um critério arbitrário, mas
 * estável e explicável, que é o que interessa quando alguém perguntar
 * porque recebeu menos um.
 */
export const splitEqually = (total: bigint, userIds: string[]): SplitShare[] => {
    if (userIds.length === 0) {
        return [];
    }

    const quantos = BigInt(userIds.length);

    const base = total / quantos;
    const resto = total % quantos;

    return userIds.map((userId, indice) => ({
        userId,
        amount: base + (BigInt(indice) < resto ? 1n : 0n),
    }));
};

/**
 * Soma as partes de uma divisão.
 */
export const sumShares = (shares: SplitShare[]): bigint =>
    shares.reduce((total, share) => total + share.amount, 0n);

export interface WeightedMember {
    userId: string;
    weight: number;
}

/**
 * Divide um total em proporção a pesos.
 *
 * Usa o método do maior resto, que é o mesmo que se usa para repartir
 * lugares por votos: cada um recebe a sua parte inteira, e as unidades
 * que sobram vão para quem ficou com a maior fração por satisfazer.
 *
 * É preferível a arredondar cada parte por si porque arredondamentos
 * independentes não fecham: com três pesos iguais sobre um total de 100,
 * arredondar 33,33 três vezes dá 99 ou 102, nunca 100. Aqui a soma é
 * sempre exatamente o total.
 *
 * Empates são desfeitos pela ordem de entrada — que quem chama ordena
 * por antiguidade — para que a mesma divisão dê sempre o mesmo
 * resultado.
 */
export const splitByWeight = (
    total: bigint,
    membros: WeightedMember[],
): SplitShare[] => {
    if (membros.length === 0) {
        return [];
    }

    const pesoTotal = membros.reduce(
        (soma, membro) => soma + BigInt(Math.max(0, Math.trunc(membro.weight))),
        0n,
    );

    /**
     * Sem peso nenhum não há proporção que se calcule. Repartir por
     * igual é a leitura menos surpreendente, e evita devolver zeros a
     * toda a gente e deixar o dinheiro preso.
     */
    if (pesoTotal === 0n) {
        return splitEqually(
            total,
            membros.map((membro) => membro.userId),
        );
    }

    const partes = membros.map((membro) => {
        const peso = BigInt(Math.max(0, Math.trunc(membro.weight)));
        const exato = total * peso;

        return {
            userId: membro.userId,
            amount: exato / pesoTotal,
            /**
             * O que sobrou por atribuir, ainda por dividir pelo peso
             * total. Comparar restos assim evita vírgula flutuante.
             */
            resto: exato % pesoTotal,
        };
    });

    const atribuido = partes.reduce((soma, parte) => soma + parte.amount, 0n);

    let porAtribuir = total - atribuido;

    /**
     * A ordem original é preservada na resposta; esta é só para decidir
     * quem recebe as unidades que sobram.
     */
    const porMaiorResto = partes
        .map((parte, indice) => ({ indice, resto: parte.resto }))
        .sort((a, b) => {
            if (a.resto === b.resto) {
                return a.indice - b.indice;
            }

            return a.resto > b.resto ? -1 : 1;
        });

    for (const candidato of porMaiorResto) {
        if (porAtribuir <= 0n) {
            break;
        }

        const parte = partes[candidato.indice];

        if (parte) {
            parte.amount += 1n;
            porAtribuir -= 1n;
        }
    }

    return partes.map((parte) => ({ userId: parte.userId, amount: parte.amount }));
};
