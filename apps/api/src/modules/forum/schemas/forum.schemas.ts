import { z } from 'zod';

import {
    CORPO_MAXIMO,
    CORPO_MINIMO,
    NOTA_MAXIMA,
    TITULO_MAXIMO,
    TITULO_MINIMO,
    normalizarTexto,
    temConteudo,
} from '@vicehub/database';

/**
 * O texto normaliza **antes** de ser medido.
 *
 * Sem isso, quinze quebras de linha e uma palavra passavam o mínimo de
 * doze caracteres: contava-se o que não se ia guardar. A ordem é a
 * decisão toda — medir depois de arrumar mede o que fica.
 */
const texto = (minimo: number, maximo: number, oQue: string) =>
    z
        .string()
        .transform(normalizarTexto)
        .refine((valor) => valor.length >= minimo, {
            message: `${oQue} precisa de pelo menos ${minimo} caracteres.`,
        })
        .refine((valor) => valor.length <= maximo, {
            message: `${oQue} não pode passar dos ${maximo} caracteres.`,
        })
        .refine(temConteudo, {
            message: `${oQue} não pode ser só espaços.`,
        });

export const createTopicSchema = z.object({
    title: texto(TITULO_MINIMO, TITULO_MAXIMO, 'O título'),
    body: texto(CORPO_MINIMO, CORPO_MAXIMO, 'A pergunta'),
});

export const createReplySchema = z.object({
    body: texto(CORPO_MINIMO, CORPO_MAXIMO, 'A resposta'),
});

export const topicIdParamSchema = z.object({
    topicId: z.string().uuid(),
});

export const replyIdParamSchema = z.object({
    replyId: z.string().uuid(),
});

export const listTopicsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
});

/**
 * Uma denúncia.
 *
 * A razão é de uma lista fechada, porque é dela que o moderador decide
 * o que abrir primeiro. A nota é livre, curta e opcional: é o que ele
 * precisa de ler para saber onde olhar, e não um processo.
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
 * decisão só, e o que muda é a conclusão que ela leva. As duas
 * conclusões são precisas — "foi visto e está bem" poupa ao moderador
 * seguinte olhar outra vez para a mesma coisa.
 */
export const handleReportSchema = z.object({
    outcome: z.enum(['acted', 'dismissed']),
});

export type CreateTopicDto = z.infer<typeof createTopicSchema>;
export type CreateReplyDto = z.infer<typeof createReplySchema>;
export type TopicIdParamDto = z.infer<typeof topicIdParamSchema>;
export type ReplyIdParamDto = z.infer<typeof replyIdParamSchema>;
export type ListTopicsQueryDto = z.infer<typeof listTopicsQuerySchema>;
export type CreateReportDto = z.infer<typeof createReportSchema>;
export type ReportIdParamDto = z.infer<typeof reportIdParamSchema>;
export type ListReportsQueryDto = z.infer<typeof listReportsQuerySchema>;
export type HandleReportDto = z.infer<typeof handleReportSchema>;
