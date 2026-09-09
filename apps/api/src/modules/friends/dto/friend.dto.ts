import type { z } from 'zod';

import type { friendParamSchema } from '../schemas/friend.schemas.js';

export type FriendParamDto = z.infer<typeof friendParamSchema>;
