import { z } from 'zod';

import { NOTA_MAXIMA, normalizarTexto } from '@vicehub/database';

/**
 * Uma denúncia.
 *
 * A razão é de uma lista fechada, porque é dela que o moderador decide
 * o que abrir primeiro. A nota é livre, curta e opcional: é o que ele
 * precisa de ler para saber onde olhar, e não um processo.
 *
 * O mesmo corpo para as três superfícies. Quem denuncia uma pergunta,
 * uma resposta ou um anúncio está a fazer a mesma coisa, e três corpos
 * diferentes eram três sítios onde a lista de razões podia divergir.
 */
export const createReportSchema = z.object({
    reason: z.enum(['spam', 'abuse', 'off_topic', 'other']),
    note: z
        .string()
        .transform(normalizarTexto)
        .refine((valor) => valor.length <= NOTA_MAXIMA, {
            message: `A nota não pode passar dos ${NOTA_MAXIMA} caracteres.`,
        })
        .optional(),
});

export const reportIdParamSchema = z.object({
    reportId: z.string().uuid(),
});

/**
 * A fila de quem modera.
 *
 * Por omissão as abertas, que são as que têm trabalho por fazer. As
 * fechadas continuam a poder ser vistas — um moderador a explicar-se
 * precisa de mostrar o que decidiu, e não só o que está por decidir.
 */
export const listReportsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    status: z.enum(['open', 'acted', 'dismissed']).default('open'),
});

/**
 * O que um moderador concluiu.
 *
 * Uma rota e um resultado, e não duas rotas: fechar uma denúncia é uma
 * decisão só, e o que muda é a conclusão que ela leva.
 */
export const handleReportSchema = z.object({
    outcome: z.enum(['acted', 'dismissed']),
});

export type CreateReportDto = z.infer<typeof createReportSchema>;
export type ReportIdParamDto = z.infer<typeof reportIdParamSchema>;
export type ListReportsQueryDto = z.infer<typeof listReportsQuerySchema>;
export type HandleReportDto = z.infer<typeof handleReportSchema>;
