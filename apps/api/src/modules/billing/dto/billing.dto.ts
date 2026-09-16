import { z } from 'zod';

import {
    openPortalSchema,
    startCheckoutSchema,
} from '../schemas/billing.schemas.js';

export type StartCheckoutDto = z.infer<typeof startCheckoutSchema>;
export type OpenPortalDto = z.infer<typeof openPortalSchema>;
