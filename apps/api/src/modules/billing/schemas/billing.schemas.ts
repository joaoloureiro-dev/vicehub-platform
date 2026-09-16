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
    /**
     * Qual dos escalões se está a comprar.
     *
     * Não se valida aqui contra a lista de planos: o que está à venda
     * depende do que esta instalação tem configurado no Stripe, e isso
     * é do serviço. O que aqui se garante é que veio alguma coisa — um
     * pedido sem plano chegava ao serviço a perguntar por `undefined`.
     */
    plan: z.string().min(1),
});

/**
 * Abertura do painel de faturação.
 *
 * O titular vem do mesmo par que na compra: gerir um plano é a outra
 * metade de o comprar, e as duas rotas identificam o titular da mesma
 * maneira. O escalão não vem — não se escolhe nada aqui; mexe-se no que
 * já foi comprado.
 */
export const openPortalSchema = z.object({
    ownerKind: z.enum(['user', 'crew', 'server']),
    ownerId: z.string().uuid(),
});
