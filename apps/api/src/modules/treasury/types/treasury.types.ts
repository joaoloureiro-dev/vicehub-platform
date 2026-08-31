/**
 * Titular de uma carteira: exatamente um dos campos é preenchido.
 *
 * A base de dados garante a mesma regra com um CHECK.
 */
export interface WalletOwner {
    userId?: string | undefined;
    crewId?: string | undefined;
    serverId?: string | undefined;
}

export type WalletOwnerKind = 'user' | 'crew' | 'server';

/**
 * Os três saldos que uma tesouraria precisa de distinguir.
 *
 * Sem os três, uma comunidade não sabe quanto pode gastar: o saldo
 * liquidado não desconta o que já foi autorizado a sair, e comprometer
 * duas vezes o mesmo dinheiro é o erro que se segue.
 */
export interface TreasuryBalances {
    /** Soma dos movimentos aprovados. É o que está mesmo lá. */
    settled: bigint;
    /** Entradas propostas e ainda por decidir. */
    pendingIn: bigint;
    /** Saídas propostas e ainda por decidir. */
    pendingOut: bigint;
    /** O que resta depois de descontar as saídas pendentes. */
    available: bigint;
}

export interface TreasuryMovement {
    id: string;
    amount: bigint;
    direction: string;
    category: string;
    status: string;
    description: string | null;
    requestedBy: string | null;
    decidedBy: string | null;
    decidedAt: Date | null;
    createdAt: Date;
}
