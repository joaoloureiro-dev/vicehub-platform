import { prisma } from '@vicehub/database';

/**
 * Dá um plano ativo a uma crew ou a um servidor, numa suite de
 * integração.
 *
 * Existe porque **mexer no dinheiro exige plano**. Ler a tesouraria é de
 * graça — o saldo, o histórico, as divisões passadas — mas propor e
 * aprovar são o que a plataforma vende. Uma suite que exercite a
 * tesouraria tem portanto de dizer, no seu arranque, que aquela
 * comunidade paga; e é bom que o diga em vez de o herdar de um estado
 * global, porque é essa linha que lembra quem lê que o paywall existe.
 *
 * Escreve diretamente na base de dados, e não pela rota de concessão: o
 * que se está a testar é a tesouraria, não a maneira de conceder planos,
 * e passar por uma rota de administração punha um segundo sistema entre
 * o teste e o que ele quer provar.
 */
export const darPlano = async (
    owner: { crewId: string } | { serverId: string },
): Promise<void> => {
    await prisma.subscription.create({
        data: {
            ...owner,
            plan: 'premium',
            status: 'active',
            price_cents: 1_000,
            currency: 'USD',
            current_period_start: new Date(),
            /** Um mês para a frente: tempo de sobra para qualquer suite. */
            current_period_end: new Date(Date.now() + 30 * 86_400_000),
        },
    });
};
