import { z } from 'zod';

import {
    CATEGORIAS_DO_FORUM,
    CATEGORIA_POR_OMISSAO,
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
    /**
     * Onde a pergunta vai viver.
     *
     * Com omissão e não obrigatória: um cliente que não saiba de
     * categorias continua a poder perguntar, e a pergunta cai na
     * conversa geral — que é melhor do que uma recusa por um campo que
     * quem escreveu nunca viu.
     *
     * A omissão é a mesma da base de dados, vinda do mesmo sítio. Duas
     * omissões escritas em dois lados são duas respostas à mesma
     * pergunta, e qual delas ganha depende do caminho por onde o tópico
     * entre.
     */
    category: z.enum(CATEGORIAS_DO_FORUM).default(CATEGORIA_POR_OMISSAO),
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
    /**
     * O que se procura.
     *
     * Chama-se `q` e não `search` porque é uma caixa de pesquisa e é
     * assim que toda a gente lhe chama num endereço — e porque é o que
     * fica legível quando alguém partilha o link de uma procura.
     *
     * 48 caracteres é o mesmo limite do diretório de servidores. Uma
     * procura mais comprida do que um título não é uma procura.
     */
    q: z.string().trim().min(1).max(48).optional(),
    /**
     * Em que parte do fórum procurar.
     *
     * Opcional, e sem omissão: sem ela a lista é o fórum todo, que é o
     * que quem chega ao `/forum` quer ver. Uma omissão aqui escondia
     * quatro quintos do fórum a quem nunca pediu para o filtrar.
     */
    category: z.enum(CATEGORIAS_DO_FORUM).optional(),
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

export type CreateTopicDto = z.infer<typeof createTopicSchema>;
export type CreateReplyDto = z.infer<typeof createReplySchema>;
export type TopicIdParamDto = z.infer<typeof topicIdParamSchema>;
export type ReplyIdParamDto = z.infer<typeof replyIdParamSchema>;
export type ListTopicsQueryDto = z.infer<typeof listTopicsQuerySchema>;
export type CreateReportDto = z.infer<typeof createReportSchema>;
