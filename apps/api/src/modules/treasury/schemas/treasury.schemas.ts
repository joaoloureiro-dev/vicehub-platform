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
