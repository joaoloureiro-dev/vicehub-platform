import { z } from 'zod';

import {
    authResponseSchema,
    authenticatedUserSchema,
    loginSchema,
    registerSchema,
} from '../schemas/auth.schemas.js';

/**
 * DTOs inferidos automaticamente através do Zod.
 *
 * Refresh e logout não têm DTO de entrada: a identidade do pedido
 * vem do cookie HttpOnly ou do access token, nunca do corpo.
 */

export type RegisterDto = z.infer<typeof registerSchema>;

export type LoginDto = z.infer<typeof loginSchema>;

export type AuthenticatedUserDto = z.infer<typeof authenticatedUserSchema>;

export type AuthResponseDto = z.infer<typeof authResponseSchema>;
