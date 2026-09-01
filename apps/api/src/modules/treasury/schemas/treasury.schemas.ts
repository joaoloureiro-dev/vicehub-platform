import { z } from 'zod';

export const crewTreasuryParamSchema = z.object({
    crewId: z.string().uuid(),
});

export const serverTreasuryParamSchema = z.object({
    serverId: z.string().uuid(),
});

/**
 * Filtros do extrato de movimentos.
 */
export const listMovementsQuerySchema = z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'canceled']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * Proposta de movimento.
 *
 * O montante vem como texto e é convertido para BigInt: a tesouraria
 * guarda moeda de jogo em unidades inteiras, e um número de JavaScript
 * deixa de ser exato acima dos nove mil biliões. Um cliente que envie
 * um número perde precisão antes sequer de chegar aqui.
 */
export const proposeMovementSchema = z.object({
    amount: z
        .string()
        .regex(/^[1-9][0-9]{0,18}$/, 'O montante tem de ser um inteiro positivo.'),
    direction: z.enum(['credit', 'debit']),
    category: z.enum([
        'contribution',
        'server_costs',
        'marketing',
        'event',
        'prize',
        'service',
        'payout',
        'other',
    ]),
    description: z.string().trim().min(1).max(280),
});

export const crewMovementParamSchema = z.object({
    crewId: z.string().uuid(),
    movementId: z.string().uuid(),
});

export const serverMovementParamSchema = z.object({
    serverId: z.string().uuid(),
    movementId: z.string().uuid(),
});

/**
 * Proposta de divisão de ganhos.
 *
 * O total vem como texto, pela mesma razão dos movimentos. A base diz
 * como repartir: em partes iguais, ou com os valores indicados um a um.
 */
export const proposeDistributionSchema = z
    .object({
        total: z
            .string()
            .regex(/^[1-9][0-9]{0,18}$/, 'O total tem de ser um inteiro positivo.')
            .optional(),
        basis: z.enum(['equal', 'by_role', 'manual', 'participation']),
        /**
         * Só para a base por participação: o evento de onde vêm os
         * pesos. Quem participou e quanto vale cada um vem das presenças
         * confirmadas, e não do pedido.
         */
        eventId: z.string().uuid().optional(),
        /**
         * Pesos por cargo, para a divisão ponderada. Só é preciso
         * indicá-los quando a crew quer os seus em vez dos do catálogo:
         * uma acha justo o dobro para o líder, outra o triplo.
         *
         * A chave "none" cobre quem não tem cargo atribuído.
         */
        weights: z
            .object({
                crew_leader: z.number().int().min(0).max(1_000),
                crew_officer: z.number().int().min(0).max(1_000),
                crew_member: z.number().int().min(0).max(1_000),
                server_owner: z.number().int().min(0).max(1_000),
                server_moderator: z.number().int().min(0).max(1_000),
                server_member: z.number().int().min(0).max(1_000),
                none: z.number().int().min(0).max(1_000),
            })
            /**
             * Parcial e estrito: indicar só o peso do líder é o caso
             * normal, e um cargo mal escrito tem de ser recusado em vez
             * de ignorado em silêncio — quem o enviou ficaria a achar
             * que valeu alguma coisa.
             */
            .partial()
            .strict()
            .optional(),
        note: z.string().trim().max(280).optional(),
        /**
         * Só para a base manual: quanto recebe cada um.
         */
        shares: z
            .array(
                z.object({
                    userId: z.string().uuid(),
                    amount: z
                        .string()
                        .regex(/^[0-9]{1,19}$/, 'A parte tem de ser um inteiro.'),
                }),
            )
            .min(1)
            .optional(),
    })
    .refine(
        (value) =>
            value.basis === 'manual'
                ? value.shares !== undefined
                : value.total !== undefined,
        {
            message:
                'As divisões calculadas precisam do total; a manual precisa das partes.',
        },
    )
    /**
     * Sem evento, uma divisão por participação não tem por onde se
     * guiar; com evento numa base que o ignora, quem o enviou ficaria a
     * achar que ele contou para alguma coisa.
     */
    .refine(
        (value) =>
            value.basis === 'participation'
                ? value.eventId !== undefined
                : value.eventId === undefined,
        {
            message:
                'A divisão por participação precisa do evento, e só ela o aceita.',
            path: ['eventId'],
        },
    )
    /**
     * Pesos numa divisão que não é ponderada seriam ignorados em
     * silêncio, e quem os enviou ficaria a achar que valeram alguma
     * coisa.
     */
    .refine((value) => value.weights === undefined || value.basis === 'by_role', {
        message: 'Os pesos só se aplicam à divisão ponderada por cargo.',
    });

export const crewDistributionParamSchema = z.object({
    crewId: z.string().uuid(),
    distributionId: z.string().uuid(),
});
