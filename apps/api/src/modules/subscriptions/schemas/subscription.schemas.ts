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
    /**
     * O plano a conceder. Por omissão o premium, que é o caso normal.
     *
     * O vitalício pede-se pelo nome porque é um gesto excecional: dá
     * acesso para sempre e sem cobrança, e não deve poder sair de um
     * pedido a que alguém se esqueceu de pôr um campo.
     */
    plan: z.enum(['premium', 'lifetime']).optional(),
})
    /**
     * Meses num plano que não termina seriam ignorados em silêncio, e
     * quem os enviou ficaria a achar que limitou o que afinal não tem
     * limite.
     */
    .refine((value) => value.plan !== 'lifetime' || value.months === undefined, {
        message: 'Uma subscrição vitalícia não termina, por isso não leva duração.',
        path: ['months'],
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
