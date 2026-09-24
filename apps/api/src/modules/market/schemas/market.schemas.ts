import { z } from 'zod';

import {
    ANUNCIO_CORPO_MAXIMO,
    ANUNCIO_CORPO_MINIMO,
    ANUNCIO_TITULO_MAXIMO,
    ANUNCIO_TITULO_MINIMO,
    CATEGORIAS_DE_ANUNCIO,
    MENSAGEM_MAXIMA,
    ESTADOS_DE_ANUNCIO,
    PRECO_MAXIMO,
    PRECO_MINIMO,
    normalizarTexto,
    temConteudo,
} from '@vicehub/database';

/**
 * O texto normaliza antes de ser medido, como no fórum: sem isso,
 * quinze quebras de linha e uma palavra passavam o mínimo.
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

/**
 * O preço, que chega como texto e fica `BigInt`.
 *
 * Texto e não número, e é a decisão que importa aqui: o JSON de um
 * número grande passa por `double` algures no caminho, e um preço de
 * novecentos mil milhões volta arredondado. Um preço arredondado sem
 * ninguém dar por isso é pior do que um pedido recusado.
 *
 * Só algarismos: nem sinal, nem vírgula, nem espaços. A moeda de jogo
 * não tem cêntimos, e aceitar `1.5` obrigava a decidir aqui se isso é
 * um e meio ou mil e quinhentos.
 */
const preco = z
    .string()
    .regex(/^\d+$/, 'O preço são algarismos, e mais nada.')
    .transform((valor) => BigInt(valor))
    .refine((valor) => valor >= PRECO_MINIMO, {
        message: `O preço tem de ser pelo menos ${PRECO_MINIMO}.`,
    })
    .refine((valor) => valor <= PRECO_MAXIMO, {
        message: `O preço não pode passar de ${PRECO_MAXIMO}.`,
    });

/**
 * O endereço da imagem.
 *
 * Como o do avatar: o ViceHub não aloja imagens, guarda o endereço. E
 * `null` é uma escolha — é assim que se tira a imagem de um anúncio que
 * já a tinha, sem ser preciso um verbo só para isso.
 */
const imagem = z.string().url().max(2048).nullable();

export const createListingSchema = z.object({
    category: z.enum(CATEGORIAS_DE_ANUNCIO),
    title: texto(ANUNCIO_TITULO_MINIMO, ANUNCIO_TITULO_MAXIMO, 'O título'),
    body: texto(ANUNCIO_CORPO_MINIMO, ANUNCIO_CORPO_MAXIMO, 'A descrição'),
    price: preco,
    imageUrl: imagem.optional(),
});

/**
 * Editar.
 *
 * Todos os campos opcionais, e pelo menos um preenchido: mudar só o
 * preço é a edição mais comum que há, e obrigar a reenviar o anúncio
 * inteiro para isso convidava o formulário a sobrescrever o que outra
 * pessoa nunca tocou.
 */
export const updateListingSchema = z
    .object({
        category: z.enum(CATEGORIAS_DE_ANUNCIO).optional(),
        title: texto(
            ANUNCIO_TITULO_MINIMO,
            ANUNCIO_TITULO_MAXIMO,
            'O título',
        ).optional(),
        body: texto(
            ANUNCIO_CORPO_MINIMO,
            ANUNCIO_CORPO_MAXIMO,
            'A descrição',
        ).optional(),
        price: preco.optional(),
        imageUrl: imagem.optional(),
    })
    .refine((valores) => Object.values(valores).some((um) => um !== undefined), {
        message: 'Não há nada para mudar.',
    });

/**
 * Fechar.
 *
 * Uma rota e um resultado, como a decisão de uma denúncia: fechar é uma
 * coisa só, e o que muda é como acabou. Vendido e retirado são precisos
 * os dois — o preço por que uma coisa saiu é a única informação que um
 * mercado tem sobre quanto valem as coisas.
 */
export const closeListingSchema = z.object({
    outcome: z.enum(['sold', 'withdrawn']),
});

export const serverIdParamSchema = z.object({
    serverId: z.string().uuid(),
});

export const listingIdParamSchema = z.object({
    listingId: z.string().uuid(),
});

/**
 * A listagem.
 *
 * Por omissão só os abertos, que são os que se podem comprar. Os
 * fechados continuam a poder ser pedidos de propósito: é neles que está
 * o histórico de preços, e escondê-los de vez tornava-o inútil.
 */
export const listListingsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    category: z.enum(CATEGORIAS_DE_ANUNCIO).optional(),
    status: z.enum(ESTADOS_DE_ANUNCIO).default('open'),
});

export type CreateListingDto = z.infer<typeof createListingSchema>;
export type UpdateListingDto = z.infer<typeof updateListingSchema>;
export type CloseListingDto = z.infer<typeof closeListingSchema>;
export type ServerIdParamDto = z.infer<typeof serverIdParamSchema>;
export type ListingIdParamDto = z.infer<typeof listingIdParamSchema>;
export type ListListingsQueryDto = z.infer<typeof listListingsQuerySchema>;

/**
 * Uma mensagem.
 *
 * O mínimo é um caractere depois de arrumado: "sim" é uma resposta
 * completa a "ainda tens isso?", e exigir mais obrigava as pessoas a
 * escrever de mais para dizer o mesmo.
 */
export const sendMessageSchema = z.object({
    body: texto(1, MENSAGEM_MAXIMA, 'A mensagem'),
});

export const conversationIdParamSchema = z.object({
    conversationId: z.string().uuid(),
});

export const messageIdParamSchema = z.object({
    messageId: z.string().uuid(),
});

export const listConversationsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
});

export type SendMessageDto = z.infer<typeof sendMessageSchema>;
export type ConversationIdParamDto = z.infer<typeof conversationIdParamSchema>;
export type MessageIdParamDto = z.infer<typeof messageIdParamSchema>;
export type ListConversationsQueryDto = z.infer<
    typeof listConversationsQuerySchema
>;
