import { z } from 'zod';

import {
    authResponseSchema,
    loginSchema,
    logoutAllSchema,
    logoutSchema,
    refreshTokenSchema,
    registerSchema,
} from '../schemas/auth.schemas.js';

/**
 * DTOs inferidos automaticamente através do Zod.
 */

export type RegisterDto = z.infer<typeof registerSchema>;

export type LoginDto = z.infer<typeof loginSchema>;

export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

export type LogoutDto = z.infer<typeof logoutSchema>;

export type LogoutAllDto = z.infer<typeof logoutAllSchema>;

export type AuthResponseDto = z.infer<typeof authResponseSchema>;