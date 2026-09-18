import { z } from 'zod';

import {
    CORPO_MAXIMO,
    CORPO_MINIMO,
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

export type CreateTopicDto = z.infer<typeof createTopicSchema>;
export type CreateReplyDto = z.infer<typeof createReplySchema>;
export type TopicIdParamDto = z.infer<typeof topicIdParamSchema>;
export type ReplyIdParamDto = z.infer<typeof replyIdParamSchema>;
export type ListTopicsQueryDto = z.infer<typeof listTopicsQuerySchema>;
