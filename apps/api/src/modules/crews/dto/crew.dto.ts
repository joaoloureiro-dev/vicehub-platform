import { z } from 'zod';

import {
    createCrewSchema,
    crewIdParamSchema,
    crewMemberParamSchema,
    setMemberRoleSchema,
    updateCrewSchema,
} from '../schemas/crew.schemas.js';

export type CreateCrewDto = z.infer<typeof createCrewSchema>;
export type UpdateCrewDto = z.infer<typeof updateCrewSchema>;
export type CrewIdParamDto = z.infer<typeof crewIdParamSchema>;
export type CrewMemberParamDto = z.infer<typeof crewMemberParamSchema>;
export type SetMemberRoleDto = z.infer<typeof setMemberRoleSchema>;
