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
        /**
         * Os requisitos são mais longos do que a descrição de propósito:
         * uma lista de condições ("18+", "microfone", "jogamos às
         * terças") ocupa mais do que uma frase de apresentação, e cortar
         * a meio o que uma crew exige a quem entra faria a candidatura
         * chegar mal informada.
         */
        joinRequirements: z.string().trim().max(1000).nullable(),
        /**
         * Anunciar que se recruta é uma escolha, e não uma dedução.
         *
         * Ter requisitos escritos ou lugares livres não põe ninguém no
         * quadro de recrutamento: quem manda na crew é que diz que quer
         * lá estar.
         */
        isRecruiting: z.boolean(),
    })
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
        message: 'Indica pelo menos um campo a alterar.',
    });

/**
 * O que se escreve ao pedir entrada numa crew.
 *
 * Opcional de propósito. Uma crew que não escreveu requisitos nenhuns
 * não tem por que exigir uma redação, e obrigar a escrever para poder
 * pedir entrada punha uma porta onde não havia nenhuma.
 *
 * Mais longo do que os requisitos que a crew escreve: quem responde
 * costuma escrever mais do que quem pergunta, e cortar a meio a
 * apresentação de alguém é a pior primeira impressão possível.
 */
export const joinRequestSchema = z
    .object({
        message: z.string().trim().min(1).max(2000).optional(),
    })
    /**
     * O corpo inteiro pode não existir.
     *
     * Esta rota já existia sem corpo nenhum — era um botão que se
     * clicava — e continua a haver quem lhe chame assim. Sem isto, pôr
     * um esquema no corpo fazia esses pedidos passarem a responder 400:
     * uma funcionalidade nova a partir a antiga, que é a pior maneira de
     * acrescentar seja o que for.
     */
    .nullish()
    .transform((valor) => valor ?? {});

/**
 * O que quem recusa pode escrever a quem recusou.
 *
 * Opcional, e o corpo inteiro pode não existir: quem já usa esta rota
 * sem corpo nenhum continua a poder. Uma funcionalidade nova a partir a
 * antiga é a pior maneira de acrescentar seja o que for — foi assim que
 * a rota de candidatura se partiu na primeira tentativa.
 */
export const rejectRequestSchema = z
    .object({
        reason: z.string().trim().min(1).max(500).optional(),
    })
    .nullish()
    .transform((valor) => valor ?? {});

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
    /**
     * Só as crews que anunciaram que recrutam.
     *
     * Aceita apenas 'true': o quadro de recrutamento é uma lista de quem
     * recruta, e não há pergunta nenhuma cuja resposta seja "mostra-me
     * as que **não** recrutam". Filtrar ao contrário só serviria para
     * fazer uma lista de crews a quem não se deve pedir entrada.
     */
    recruiting: z
        .literal('true')
        .transform(() => true)
        .optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    sort: z.enum(['newest', 'level', 'name']).default('newest'),
});
