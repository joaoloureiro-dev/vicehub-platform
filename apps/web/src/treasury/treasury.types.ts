/**
 * A tesouraria.
 *
 * **Todos os montantes são `string`, e assim ficam.** São `BigInt` na
 * base de dados, e a API manda-os em texto de propósito: um número de
 * JavaScript deixa de ser exato acima dos nove mil biliões. Convertê-los
 * aqui para os somar ou formatar apagaria a razão de a API ter tido esse
 * cuidado — e num sistema com economia, uma unidade perdida numa
 * conversão é uma unidade que ninguém consegue explicar.
 */
export interface TreasuryBalances {
    /** Soma dos movimentos aprovados. É o que está mesmo lá. */
    settled: string;
    /** Entradas propostas e ainda por decidir. */
    pendingIn: string;
    /** Saídas propostas e ainda por decidir. */
    pendingOut: string;
    /** O que resta depois de descontar as saídas pendentes. */
    available: string;
}

export type MovementStatus = 'pending' | 'approved' | 'rejected' | 'canceled';
export type MovementDirection = 'credit' | 'debit';

export type MovementCategory =
    | 'contribution'
    | 'server_costs'
    | 'marketing'
    | 'event'
    | 'prize'
    | 'service'
    | 'payout'
    | 'other';

export interface TreasuryMovement {
    id: string;
    amount: string;
    direction: string;
    category: string;
    status: string;
    description: string | null;
    requestedBy: string | null;
    decidedBy: string | null;
    decidedAt: string | null;
    createdAt: string;
}

export interface TreasuryView {
    balances: TreasuryBalances;
    movements: TreasuryMovement[];
}

export type DistributionBasis = 'equal' | 'by_role' | 'manual' | 'participation';

export interface Distribution {
    id: string;
    total: string;
    basis: string;
    status: string;
    eventId: string | null;
    note: string | null;
    requestedBy: string | null;
    decidedBy: string | null;
    decidedAt: string | null;
    createdAt: string;
    /** Uma linha por pessoa: é isto que se paga se for aprovada. */
    lines: TreasuryMovement[];
}

/* ---------- como se diz cada coisa a uma pessoa ---------- */

export const NOME_DA_CATEGORIA: Record<string, string> = {
    contribution: 'Contribuição',
    server_costs: 'Custos do servidor',
    marketing: 'Marketing',
    event: 'Evento',
    prize: 'Prémio',
    service: 'Serviço',
    payout: 'Pagamento',
    other: 'Outro',
};

export const NOME_DO_ESTADO: Record<string, string> = {
    pending: 'Por decidir',
    approved: 'Aprovado',
    rejected: 'Recusado',
    canceled: 'Cancelado',
};

export const NOME_DA_BASE: Record<string, string> = {
    equal: 'Em partes iguais',
    by_role: 'Ponderada por cargo',
    manual: 'Valores indicados um a um',
    participation: 'Por quem apareceu',
};

export const nomeDaCategoria = (valor: string): string =>
    NOME_DA_CATEGORIA[valor] ?? valor;

export const nomeDoEstado = (valor: string): string =>
    NOME_DO_ESTADO[valor] ?? valor;

export const nomeDaBase = (valor: string): string => NOME_DA_BASE[valor] ?? valor;

/**
 * Agrupa os dígitos de um montante, **sem lhe tocar**.
 *
 * Recebe texto e devolve texto. Nada de `Number`, nada de
 * `toLocaleString`: o valor pode ser maior do que um número de
 * JavaScript aguenta, e formatá-lo não é razão para o estragar.
 */
/** Espaço inquebrável (U+00A0), escrito assim para não ser invisível no código. */
export const SEPARADOR = '\u00A0';

/** Sinal de menos (U+2212), que não é o hífen do teclado. */
export const MENOS = '\u2212';

export const formatarMontante = (valor: string): string => {
    const negativo = valor.startsWith('-');
    const digitos = negativo ? valor.slice(1) : valor;

    /**
     * Espaço inquebrável entre os grupos, e não um espaço normal: um
     * montante partido ao meio no fim de uma linha lê-se como dois
     * números diferentes.
     */
    const agrupado = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, SEPARADOR);

    return negativo ? `${MENOS}${agrupado}` : agrupado;
};

/**
 * Que tamanho dar ao saldo em destaque.
 *
 * A moeda do jogo vai até dezanove dígitos, e um número desses a 40px
 * não cabe num telemóvel — ficava cortado, que é a pior das saídas: um
 * montante cortado lê-se como outro montante. O tamanho acompanha o
 * comprimento, para que o valor caiba sempre por inteiro.
 */
export const tamanhoDoSaldo = (valor: string): string => {
    const largura = formatarMontante(valor).length;

    if (largura <= 9) {
        return 'clamp(30px, 9vw, 40px)';
    }

    if (largura <= 14) {
        return 'clamp(24px, 7vw, 34px)';
    }

    return 'clamp(17px, 5vw, 27px)';
};

/** O sinal que se mostra ao lado de um movimento. */
export const sinalDoMovimento = (direction: string): string =>
    direction === 'debit' ? MENOS : '+';
