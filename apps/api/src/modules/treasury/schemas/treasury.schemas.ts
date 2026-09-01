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

/**
 * Proposta de divisão de ganhos.
 *
 * O total vem como texto, pela mesma razão dos movimentos. A base diz
 * como repartir: em partes iguais, ou com os valores indicados um a um.
 */
export const proposeDistributionSchema = z
    .object({
        total: z
            .string()
            .regex(/^[1-9][0-9]{0,18}$/, 'O total tem de ser um inteiro positivo.')
            .optional(),
        basis: z.enum(['equal', 'manual']),
        note: z.string().trim().max(280).optional(),
        /**
         * Só para a base manual: quanto recebe cada um.
         */
        shares: z
            .array(
                z.object({
                    userId: z.string().uuid(),
                    amount: z
                        .string()
                        .regex(/^[0-9]{1,19}$/, 'A parte tem de ser um inteiro.'),
                }),
            )
            .min(1)
            .optional(),
    })
    .refine(
        (value) =>
            value.basis === 'equal' ? value.total !== undefined : value.shares !== undefined,
        {
            message:
                'A divisão em partes iguais precisa do total; a manual precisa das partes.',
        },
    );

export const crewDistributionParamSchema = z.object({
    crewId: z.string().uuid(),
    distributionId: z.string().uuid(),
});
