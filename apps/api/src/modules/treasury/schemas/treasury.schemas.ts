import { z } from 'zod';

export const crewTreasuryParamSchema = z.object({
    crewId: z.string().uuid(),
});

export const serverTreasuryParamSchema = z.object({
    serverId: z.string().uuid(),
});

/**
 * Filtros do extrato de movimentos.
 */
export const listMovementsQuerySchema = z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'canceled']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * Proposta de movimento.
 *
 * O montante vem como texto e é convertido para BigInt: a tesouraria
 * guarda moeda de jogo em unidades inteiras, e um número de JavaScript
 * deixa de ser exato acima dos nove mil biliões. Um cliente que envie
 * um número perde precisão antes sequer de chegar aqui.
 */
export const proposeMovementSchema = z.object({
    amount: z
        .string()
        .regex(/^[1-9][0-9]{0,18}$/, 'O montante tem de ser um inteiro positivo.'),
    direction: z.enum(['credit', 'debit']),
    category: z.enum([
        'contribution',
        'server_costs',
        'marketing',
        'event',
        'prize',
        'service',
        'payout',
        'other',
    ]),
    description: z.string().trim().min(1).max(280),
});

export const crewMovementParamSchema = z.object({
    crewId: z.string().uuid(),
    movementId: z.string().uuid(),
});

export const serverMovementParamSchema = z.object({
    serverId: z.string().uuid(),
    movementId: z.string().uuid(),
});
