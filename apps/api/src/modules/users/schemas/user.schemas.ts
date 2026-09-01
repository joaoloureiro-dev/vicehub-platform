import { z } from 'zod';

export { updateAppearanceSchema } from '../../../shared/appearance.js';

/**
 * Personalização tal como sai numa resposta.
 */
const appearanceSchema = z.object({
    bannerUrl: z.string().nullable(),
    accentColor: z.string().nullable(),
});

/**
 * Perfil visível a qualquer pessoa.
 *
 * Não inclui email, data do último início de sessão nem qualquer detalhe
 * de faturação. O selo premium é um booleano: dizer que alguém é premium
 * é diferente de expor até quando pagou.
 */
export const publicProfileSchema = z.object({
    id: z.string(),
    username: z.string(),
    avatarUrl: z.string().nullable(),
    bio: z.string().nullable(),
    level: z.number(),
    xp: z.string(),
    reputation: z.number(),
    isPremium: z.boolean(),
    appearance: appearanceSchema,
    createdAt: z.string(),
});

/**
 * Perfil do próprio, com o que só ao titular diz respeito.
 */
export const privateProfileSchema = publicProfileSchema.extend({
    email: z.string(),
    emailVerifiedAt: z.string().nullable(),
    lastLoginAt: z.string().nullable(),
    premiumUntil: z.string().nullable(),
});

/**
 * Alteração do próprio perfil.
 *
 * Apenas campos de apresentação. O email e o username não se alteram
 * por aqui: mexem em identidade e unicidade, e merecem fluxos próprios
 * com verificação.
 */
export const updateProfileSchema = z
    .object({
        avatarUrl: z.string().url().max(2048).nullable(),
        bio: z.string().trim().max(500).nullable(),
    })
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
        message: 'Indica pelo menos um campo a alterar.',
    });

export const usernameParamSchema = z.object({
    username: z
        .string()
        .trim()
        .min(3)
        .max(32)
        .regex(/^[a-zA-Z0-9_.-]+$/),
});
