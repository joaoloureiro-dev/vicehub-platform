import { z } from 'zod';

import {
    crewDistributionParamSchema,
    crewMovementParamSchema,
    proposeDistributionSchema,
    crewTreasuryParamSchema,
    proposeMovementSchema,
    serverMovementParamSchema,
    listMovementsQuerySchema,
    serverTreasuryParamSchema,
} from '../schemas/treasury.schemas.js';

export type CrewTreasuryParamDto = z.infer<typeof crewTreasuryParamSchema>;
export type ServerTreasuryParamDto = z.infer<typeof serverTreasuryParamSchema>;
export type ListMovementsQueryDto = z.infer<typeof listMovementsQuerySchema>;
export type ProposeMovementDto = z.infer<typeof proposeMovementSchema>;
export type CrewMovementParamDto = z.infer<typeof crewMovementParamSchema>;
export type ServerMovementParamDto = z.infer<typeof serverMovementParamSchema>;
export type ProposeDistributionDto = z.infer<typeof proposeDistributionSchema>;
export type CrewDistributionParamDto = z.infer<typeof crewDistributionParamSchema>;
