import { z } from 'zod';

import {
    createServerSchema,
    listServersQuerySchema,
    serverIdParamSchema,
    serverMemberParamSchema,
    setServerMemberRoleSchema,
    updateServerSchema,
} from '../schemas/server.schemas.js';

export type CreateServerDto = z.infer<typeof createServerSchema>;
export type UpdateServerDto = z.infer<typeof updateServerSchema>;
export type ServerIdParamDto = z.infer<typeof serverIdParamSchema>;
export type ServerMemberParamDto = z.infer<typeof serverMemberParamSchema>;
export type SetServerMemberRoleDto = z.infer<typeof setServerMemberRoleSchema>;
export type ListServersQueryDto = z.infer<typeof listServersQuerySchema>;
