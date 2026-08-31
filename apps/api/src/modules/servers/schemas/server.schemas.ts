import { z } from 'zod';

/**
 * O nome identifica o servidor no diretório e tem unicidade na base de
 * dados, por isso é validado com o mesmo rigor do nome de uma crew.
 */
export const createServerSchema = z.object({
    name: z.string().trim().min(3).max(48),
    region: z.string().trim().min(2).max(32).nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
});

export const updateServerSchema = z
    .object({
        name: z.string().trim().min(3).max(48),
        region: z.string().trim().min(2).max(32).nullable(),
        description: z.string().trim().max(500).nullable(),
        isOnline: z.boolean(),
    })
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
        message: 'Indica pelo menos um campo a alterar.',
    });

export const serverIdParamSchema = z.object({
    serverId: z.string().uuid(),
});

export const serverMemberParamSchema = z.object({
    serverId: z.string().uuid(),
    userId: z.string().uuid(),
});

/**
 * Cargos que podem ser atribuídos dentro de um servidor.
 *
 * Fica fora do catálogo global de propósito: aqui interessa apenas o
 * subconjunto que faz sentido num servidor.
 */
export const setServerMemberRoleSchema = z.object({
    role: z.enum(['server_owner', 'server_moderator', 'server_member']),
});

/**
 * Filtros do diretório de servidores.
 *
 * Segue o diretório de crews: números convertidos a partir do texto da
 * query e um tecto por página, para que um pedido não possa arrastar o
 * diretório inteiro.
 */
export const listServersQuerySchema = z.object({
    search: z.string().trim().min(1).max(48).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    sort: z.enum(['newest', 'name']).default('newest'),
    onlineOnly: z
        .union([z.literal('true'), z.literal('false')])
        .transform((value) => value === 'true')
        .optional(),
});
