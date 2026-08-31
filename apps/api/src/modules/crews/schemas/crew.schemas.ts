import { z } from 'zod';

/**
 * O nome e a tag identificam a crew publicamente e têm unicidade na
 * base de dados, por isso são validados com o mesmo rigor do username.
 */
export const createCrewSchema = z.object({
    name: z.string().trim().min(3).max(48),
    tag: z
        .string()
        .trim()
        .min(2)
        .max(8)
        .regex(/^[A-Za-z0-9]+$/, 'A tag só pode ter letras e números.'),
    description: z.string().trim().max(500).nullable().optional(),
});

export const updateCrewSchema = z
    .object({
        name: z.string().trim().min(3).max(48),
        description: z.string().trim().max(500).nullable(),
    })
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
        message: 'Indica pelo menos um campo a alterar.',
    });

export const crewIdParamSchema = z.object({
    crewId: z.string().uuid(),
});

export const crewMemberParamSchema = z.object({
    crewId: z.string().uuid(),
    userId: z.string().uuid(),
});

/**
 * Cargos que podem ser atribuídos dentro de uma crew.
 *
 * Fica fora do catálogo global de propósito: aqui interessa apenas o
 * subconjunto que faz sentido numa crew.
 */
export const setMemberRoleSchema = z.object({
    role: z.enum(['crew_leader', 'crew_officer', 'crew_member']),
});

/**
 * Filtros do diretório de crews.
 *
 * Os parâmetros de query chegam sempre como texto, por isso os números
 * são convertidos antes de validados. O limite por página é fechado a
 * 50: sem tecto, um pedido podia arrastar o diretório inteiro.
 */
export const listCrewsQuerySchema = z.object({
    search: z.string().trim().min(1).max(48).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    sort: z.enum(['newest', 'level', 'name']).default('newest'),
});
