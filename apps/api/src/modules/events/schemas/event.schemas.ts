import { z } from 'zod';

/**
 * Parâmetros das rotas, por titular.
 *
 * O identificador da crew ou do servidor **tem de estar no schema**,
 * ainda que venha do prefixo e nenhum handler o leia daqui: o Zod
 * descarta o que o schema não declara, e o guard de autorização lê o
 * âmbito precisamente desses parâmetros. Omiti-los faria a permissão ser
 * avaliada sem âmbito nenhum — o cargo de líder da crew deixaria de
 * contar, e a rota recusaria a quem manda nela.
 */
/**
 * O parâmetro de âmbito que estas rotas recebem do prefixo.
 *
 * O tipo do retorno é anotado para que as duas variantes não formem uma
 * união: sem isso, o TypeScript infere `serverId?: never` no ramo da
 * crew, e nenhum schema chega a servir para as duas.
 */
const ownerShape = (
    kind: 'crew' | 'server',
): {
    crewId?: z.ZodString | undefined;
    serverId?: z.ZodString | undefined;
} =>
    kind === 'crew'
        ? { crewId: z.string().uuid() }
        : { serverId: z.string().uuid() };

/**
 * O titular chega num parâmetro ou no outro, consoante o prefixo com que
 * as rotas foram registadas. O tipo declara os dois como opcionais para
 * que uma rota valha para ambos; o schema de cada registo é que exige o
 * que lhe compete.
 */
export interface EventOwnerParams {
    crewId?: string;
    serverId?: string;
}

export interface EventIdParams extends EventOwnerParams {
    eventId: string;
}

export interface EventParticipantParams extends EventIdParams {
    userId: string;
}

export const eventIdParamSchema = (kind: 'crew' | 'server') =>
    z.object({
        ...ownerShape(kind),
        eventId: z.string().uuid(),
    });

export const eventParticipantParamSchema = (kind: 'crew' | 'server') =>
    z.object({
        ...ownerShape(kind),
        eventId: z.string().uuid(),
        userId: z.string().uuid(),
    });

/**
 * Criação de um evento.
 *
 * A data vem em ISO 8601 e é convertida para Date aqui, para que o resto
 * do módulo nunca tenha de lidar com texto que pode ou não ser uma data.
 */
export const createEventSchema = z
    .object({
        name: z.string().trim().min(3).max(120),
        description: z.string().trim().max(2000).nullable().optional(),
        startsAt: z.coerce.date(),
        endsAt: z.coerce.date().nullable().optional(),
        /**
         * Sem valor é sem limite. Zero seria um evento onde ninguém pode
         * entrar, e por isso é recusado.
         */
        capacity: z.number().int().min(1).max(10_000).nullable().optional(),
    })
    .refine(
        (value) =>
            value.endsAt === null ||
            value.endsAt === undefined ||
            value.endsAt >= value.startsAt,
        {
            message: 'O evento não pode acabar antes de começar.',
            path: ['endsAt'],
        },
    );

/**
 * Alteração de um evento.
 *
 * Todos os campos são opcionais, mas a coerência entre início e fim é
 * verificada no serviço: aqui não se sabe qual é o valor que fica quando
 * só um dos dois é indicado.
 */
export const updateEventSchema = z
    .object({
        name: z.string().trim().min(3).max(120),
        description: z.string().trim().max(2000).nullable(),
        startsAt: z.coerce.date(),
        endsAt: z.coerce.date().nullable(),
        capacity: z.number().int().min(1).max(10_000).nullable(),
    })
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
        message: 'Indica pelo menos um campo a alterar.',
    });

/**
 * Filtros da lista de eventos.
 */
export const listEventsQuerySchema = z.object({
    status: z
        .enum(['scheduled', 'ongoing', 'completed', 'canceled'])
        .optional(),
    /**
     * Por omissão a lista mostra o que está para vir, que é o que
     * interessa a quem quer participar. O histórico pede-se de propósito.
     */
    includePast: z
        .union([z.literal('true'), z.literal('false')])
        .transform((value) => value === 'true')
        .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * Confirmação de presença.
 *
 * O peso é o que torna a divisão por participação diferente de uma
 * divisão por igual: quem lidera um assalto costuma levar mais, e sem
 * poder dizê-lo as comunidades voltariam a dividir fora da plataforma.
 * Sem valor, vale um — a participação simples.
 */
export const confirmAttendanceSchema = z.object({
    weight: z.number().int().min(1).max(100).optional(),
});

/**
 * Transição de estado pedida ao evento.
 */
export const eventTransitionSchema = z.object({
    status: z.enum(['ongoing', 'completed', 'canceled']),
});
