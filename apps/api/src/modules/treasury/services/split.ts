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
