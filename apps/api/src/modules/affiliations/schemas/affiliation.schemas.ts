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
