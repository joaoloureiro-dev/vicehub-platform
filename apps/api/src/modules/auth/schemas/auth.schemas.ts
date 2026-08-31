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
 *
 * A password não é validada com as regras de complexidade do registo:
 * no login queremos apenas garantir que o campo existe, sem revelar
 * qual é a política de passwords através das mensagens de erro.
 */
export const loginSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(1).max(128),
});

/**
 * Perfil devolvido nas rotas autenticadas.
 */
export const authenticatedUserSchema = z.object({
    id: z.string(),
    email: z.string(),
    username: z.string(),
});

/**
 * Resposta da autenticação.
 *
 * O refresh token não faz parte do corpo da resposta:
 * viaja exclusivamente no cookie HttpOnly.
 */
export const authResponseSchema = z.object({
    accessToken: z.string(),
    user: authenticatedUserSchema,
});
