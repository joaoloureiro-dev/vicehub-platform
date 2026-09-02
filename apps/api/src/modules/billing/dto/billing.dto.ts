import { z } from 'zod';

import { startCheckoutSchema } from '../schemas/billing.schemas.js';

export type StartCheckoutDto = z.infer<typeof startCheckoutSchema>;
