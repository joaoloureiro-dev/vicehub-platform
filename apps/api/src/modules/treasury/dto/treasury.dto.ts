import { z } from 'zod';

import {
    crewTreasuryParamSchema,
    listMovementsQuerySchema,
    serverTreasuryParamSchema,
} from '../schemas/treasury.schemas.js';

export type CrewTreasuryParamDto = z.infer<typeof crewTreasuryParamSchema>;
export type ServerTreasuryParamDto = z.infer<typeof serverTreasuryParamSchema>;
export type ListMovementsQueryDto = z.infer<typeof listMovementsQuerySchema>;
