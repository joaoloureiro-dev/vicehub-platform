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

/**
 * Pedido de recuperação de password.
 *
 * Só o email. A resposta é sempre a mesma, exista a conta ou não.
 */
export const requestPasswordResetSchema = z.object({
    email: z.string().trim().email(),
});

/**
 * Definição da password nova a partir do link.
 *
 * A password nova passa pelas mesmas regras do registo: uma conta
 * recuperada não deve ficar mais fraca do que era.
 */
export const resetPasswordSchema = z.object({
    token: z.string().min(1).max(512),
    password: passwordSchema,
});

/**
 * Confirmação do endereço de email a partir do link.
 */
export const verifyEmailSchema = z.object({
    token: z.string().min(1).max(512),
});
