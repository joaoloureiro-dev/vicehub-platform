import { z } from 'zod';

import {
    crewScopeParamSchema,
    grantSubscriptionSchema,
    serverScopeParamSchema,
    subscriptionIdParamSchema,
} from '../schemas/subscription.schemas.js';

export type GrantSubscriptionDto = z.infer<typeof grantSubscriptionSchema>;
export type SubscriptionIdParamDto = z.infer<typeof subscriptionIdParamSchema>;
export type CrewScopeParamDto = z.infer<typeof crewScopeParamSchema>;
export type ServerScopeParamDto = z.infer<typeof serverScopeParamSchema>;
