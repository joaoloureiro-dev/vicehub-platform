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
/**
 * O cartão que o CAPTCHA dá ao browser.
 *
 * Opcional aqui, e obrigatório no sítio certo: uma instalação sem
 * CAPTCHA configurado não tem como o produzir, e exigi-lo no schema
 * fechava a porta a toda a gente nessas instalações. Quem decide se ele
 * é preciso é a verificação, que sabe se o CAPTCHA está ligado.
 *
 * O teto existe porque isto vem de fora e vai parar a um corpo de
 * pedido: os cartões do Turnstile andam pelas centenas de caracteres, e
 * um megabyte de lixo neste campo não é um cartão.
 */
export const captchaTokenSchema = z.string().min(1).max(2_048).optional();

export const registerSchema = z.object({
    email: z.string().trim().email(),
    username: z
        .string()
        .trim()
        .min(3)
        .max(32)
        .regex(/^[a-zA-Z0-9_.-]+$/),
    password: passwordSchema,
    captchaToken: captchaTokenSchema,
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
    captchaToken: captchaTokenSchema,
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
 * O email e, onde a instalação tenha CAPTCHA, o cartão. A resposta é
 * sempre a mesma, exista a conta ou não.
 *
 * Esta é a terceira porta, e a única que faz a plataforma **escrever a
 * alguém** sem que quem pede prove nada: um guião a correr esta rota
 * enche a caixa de correio de outra pessoa e arde a quota do fornecedor
 * de email a caminho disso.
 */
export const requestPasswordResetSchema = z.object({
    email: z.string().trim().email(),
    captchaToken: captchaTokenSchema,
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
