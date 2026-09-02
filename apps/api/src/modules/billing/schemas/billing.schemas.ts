import { z } from 'zod';

/**
 * Início de uma compra.
 *
 * O titular é indicado pelo par tipo e identificador, como na concessão
 * manual: assim é impossível pedir um plano com dois titulares ou com
 * nenhum antes sequer de chegar ao serviço.
 */
export const startCheckoutSchema = z.object({
    ownerKind: z.enum(['user', 'crew', 'server']),
    ownerId: z.string().uuid(),
});
