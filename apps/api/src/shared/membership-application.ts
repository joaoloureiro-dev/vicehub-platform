import { z } from 'zod';

/**
 * Candidatar-se a uma comunidade, e responder a quem se candidatou.
 *
 * É a mesma coisa para crews e para servidores, por isso vive num só
 * sítio — pela mesma razão que a personalização: duas cópias divergiriam
 * ao primeiro campo novo, e candidatar-se a uma crew passaria a querer
 * dizer uma coisa diferente de candidatar-se a um servidor.
 */

/**
 * O que se escreve ao pedir entrada.
 *
 * Opcional de propósito. Uma comunidade que não escreveu requisitos
 * nenhuns não tem por que exigir uma redação, e obrigar a escrever para
 * poder pedir entrada punha uma porta onde não havia nenhuma.
 *
 * Mais longo do que os requisitos que a comunidade escreve: quem
 * responde costuma escrever mais do que quem pergunta, e cortar a meio a
 * apresentação de alguém é a pior primeira impressão possível.
 */
export const joinRequestSchema = z
    .object({
        message: z.string().trim().min(1).max(2000).optional(),
    })
    /**
     * O corpo inteiro pode não existir.
     *
     * Estas rotas já existiam sem corpo nenhum — eram botões que se
     * clicavam — e continua a haver quem lhes chame assim. Sem isto, pôr
     * um esquema no corpo fazia esses pedidos passarem a responder 400:
     * uma funcionalidade nova a partir a antiga, que é a pior maneira de
     * acrescentar seja o que for.
     */
    .nullish()
    .transform((valor) => valor ?? {});

/**
 * O que quem recusa pode escrever a quem foi recusado.
 *
 * Opcional, porque obrigar a justificar cada recusa faz com que se deixe
 * de recusar — e uma candidatura sem resposta nenhuma é pior do que um
 * "não" seco.
 */
export const rejectRequestSchema = z
    .object({
        reason: z.string().trim().min(1).max(500).optional(),
    })
    .nullish()
    .transform((valor) => valor ?? {});

export type JoinRequestDto = z.infer<typeof joinRequestSchema>;
export type RejectRequestDto = z.infer<typeof rejectRequestSchema>;
