import { z } from 'zod';

export const crewIdParamSchema = z.object({
    crewId: z.string().uuid(),
});

export const serverIdParamSchema = z.object({
    serverId: z.string().uuid(),
});

export const affiliationParamSchema = z.object({
    serverId: z.string().uuid(),
    crewId: z.string().uuid(),
});

export const requestAffiliationSchema = z.object({
    serverId: z.string().uuid(),
});

/**
 * A página do quadro de um servidor.
 *
 * Sem tecto por página: quantas cabem numa é decisão do produto e vive
 * no pacote partilhado, não numa query que qualquer pessoa escreve.
 */
export const leaderboardQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
});
