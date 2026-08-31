import { z } from 'zod';

import {
    privateProfileSchema,
    publicProfileSchema,
    updateProfileSchema,
    usernameParamSchema,
} from '../schemas/user.schemas.js';

export type PublicProfileDto = z.infer<typeof publicProfileSchema>;

export type PrivateProfileDto = z.infer<typeof privateProfileSchema>;

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

export type UsernameParamDto = z.infer<typeof usernameParamSchema>;
