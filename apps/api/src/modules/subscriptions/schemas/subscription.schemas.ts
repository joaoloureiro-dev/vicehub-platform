import { z } from 'zod';

/**
 * Concessão de um período de plano.
 *
 * O titular é indicado pelo par tipo e identificador, e não por três
 * campos opcionais: assim é impossível pedir uma subscrição com dois
 * titulares, ou com nenhum, antes sequer de chegar ao serviço.
 */
export const grantSubscriptionSchema = z.object({
    ownerKind: z.enum(['user', 'crew', 'server']),
    ownerId: z.string().uuid(),
    /**
     * Duração em meses. Por omissão vale o intervalo do plano, que é o
     * caso normal; indicar mais serve para ofertas e compensações.
     */
    months: z.number().int().min(1).max(24).optional(),
});

export const subscriptionIdParamSchema = z.object({
    subscriptionId: z.string().uuid(),
});

export const crewScopeParamSchema = z.object({
    crewId: z.string().uuid(),
});

export const serverScopeParamSchema = z.object({
    serverId: z.string().uuid(),
});
