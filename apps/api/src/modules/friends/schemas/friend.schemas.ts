import { z } from 'zod';

export const friendParamSchema = z.object({
    userId: z.string().uuid(),
});
