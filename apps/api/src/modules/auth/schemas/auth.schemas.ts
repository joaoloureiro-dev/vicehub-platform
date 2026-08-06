import { z } from 'zod';

/**
 * Password mínima para produção.
 *
 * Futuramente podemos adicionar:
 * - maiúsculas
 * - números
 * - caracteres especiais
 */
const passwordSchema = z
    .string()
    .min(8, 'A password deve ter pelo menos 8 caracteres.')
    .max(128);

/**
 * Pedido de registo.
 */
export const registerSchema = z.object({
    email: z.string().trim().email(),
    username: z
        .string()
        .trim()
        .min(3)
        .max(32)
        .regex(/^[a-zA-Z0-9_.-]+$/),
    password: passwordSchema,
});

/**
 * Pedido de login.
 */
export const loginSchema = z.object({
    email: z.string().trim().email(),
    password: passwordSchema,
});

/**
 * Pedido de refresh.
 */
export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1),
});

/**
 * Pedido de logout.
 */
export const logoutSchema = z.object({
    sessionId: z.string().uuid(),
    refreshTokenId: z.string().uuid().optional(),
});

/**
 * Pedido de logout global.
 */
export const logoutAllSchema = z.object({
    userId: z.string().uuid(),
});

/**
 * Resposta da autenticação.
 */
export const authResponseSchema = z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
});