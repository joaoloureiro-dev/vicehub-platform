import type { z } from 'zod';

import type {
    affiliationParamSchema,
    crewIdParamSchema,
    leaderboardQuerySchema,
    requestAffiliationSchema,
    serverIdParamSchema,
} from '../schemas/affiliation.schemas.js';

export type CrewIdParamDto = z.infer<typeof crewIdParamSchema>;
export type ServerIdParamDto = z.infer<typeof serverIdParamSchema>;
export type AffiliationParamDto = z.infer<typeof affiliationParamSchema>;
export type RequestAffiliationDto = z.infer<typeof requestAffiliationSchema>;
export type LeaderboardQueryDto = z.infer<typeof leaderboardQuerySchema>;
