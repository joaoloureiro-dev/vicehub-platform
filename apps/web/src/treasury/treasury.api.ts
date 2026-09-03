import { api } from '../lib/api.js';
import type {
    Distribution,
    DistributionBasis,
    MovementCategory,
    MovementDirection,
    MovementStatus,
    TreasuryView,
} from './treasury.types.js';

/**
 * A tesouraria de uma crew ou de um servidor.
 *
 * As rotas são simétricas — muda o prefixo e o nome do parâmetro — mas o
 * que se pode fazer não é: só as crews têm divisões de ganhos. Por isso
 * o prefixo é um argumento, e as divisões vivem à parte.
 */
type Dono = { tipo: 'crews'; id: string } | { tipo: 'servers'; id: string };

const base = (dono: Dono) => `/treasury/${dono.tipo}/${dono.id}`;

export const getTreasury = (
    dono: Dono,
    filtros: { status?: MovementStatus; limit?: number } = {},
): Promise<TreasuryView> => {
    const parametros = new URLSearchParams();

    if (filtros.status) {
        parametros.set('status', filtros.status);
    }

    if (filtros.limit) {
        parametros.set('limit', String(filtros.limit));
    }

    const cauda = parametros.toString();

    return api<TreasuryView>(`${base(dono)}${cauda ? `?${cauda}` : ''}`);
};

export const getMyMovements = (): Promise<TreasuryView> =>
    api<TreasuryView>('/treasury/me');

/**
 * Propõe um movimento. **Nada se move ainda.**
 *
 * Fica por decidir até alguém com autoridade o aprovar — e é nesse
 * momento, e só nesse, que o saldo muda.
 */
export const proposeMovement = (
    dono: Dono,
    input: {
        amount: string;
        direction: MovementDirection;
        category: MovementCategory;
        description: string;
    },
): Promise<unknown> =>
    api<unknown>(`${base(dono)}/movements`, { method: 'POST', body: input });

export const approveMovement = (dono: Dono, movementId: string): Promise<unknown> =>
    api<unknown>(`${base(dono)}/movements/${movementId}/approve`, {
        method: 'POST',
    });

export const rejectMovement = (dono: Dono, movementId: string): Promise<unknown> =>
    api<unknown>(`${base(dono)}/movements/${movementId}/reject`, {
        method: 'POST',
    });

export const cancelMovement = (dono: Dono, movementId: string): Promise<void> =>
    api<void>(`${base(dono)}/movements/${movementId}`, { method: 'DELETE' });

/* ---------- divisões de ganhos, só para crews ---------- */

export interface ProporDivisao {
    basis: DistributionBasis;
    /** Obrigatório em tudo menos na base manual. */
    total?: string;
    /** Só na base por participação, e só nela. */
    eventId?: string;
    note?: string;
}

export const listDistributions = (crewId: string): Promise<Distribution[]> =>
    api<Distribution[]>(`/treasury/crews/${crewId}/distributions`);

/**
 * Propõe uma divisão.
 *
 * Os campos que não se aplicam **não são enviados**: a API recusa um
 * evento numa base que o ignora, e recusa pesos fora da divisão
 * ponderada. Mandá-los à mesma daria um 400 que se lê como avaria em vez
 * de como "esse campo não é desta base".
 */
export const proposeDistribution = (
    crewId: string,
    input: ProporDivisao,
): Promise<Distribution> => {
    const corpo: Record<string, unknown> = { basis: input.basis };

    if (input.basis !== 'manual' && input.total) {
        corpo['total'] = input.total;
    }

    if (input.basis === 'participation' && input.eventId) {
        corpo['eventId'] = input.eventId;
    }

    if (input.note) {
        corpo['note'] = input.note;
    }

    return api<Distribution>(`/treasury/crews/${crewId}/distributions`, {
        method: 'POST',
        body: corpo,
    });
};

export const approveDistribution = (
    crewId: string,
    distributionId: string,
): Promise<unknown> =>
    api<unknown>(
        `/treasury/crews/${crewId}/distributions/${distributionId}/approve`,
        { method: 'POST' },
    );

export const rejectDistribution = (
    crewId: string,
    distributionId: string,
): Promise<unknown> =>
    api<unknown>(
        `/treasury/crews/${crewId}/distributions/${distributionId}/reject`,
        { method: 'POST' },
    );

export type { Dono };
