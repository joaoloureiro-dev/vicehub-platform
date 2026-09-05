import type { PrismaClient } from '@prisma/client';

/**
 * Apagar o que já não serve: tokens e sessões expirados.
 *
 * Nada quebra por não correr — um token expirado é recusado na mesma —,
 * mas estas são as três tabelas que mais crescem: cada login abre uma
 * sessão, cada renovação escreve um refresh token, e cada pedido de
 * recuperação escreve um token de conta.
 *
 * As regras vivem aqui, e não no script, porque são a parte que pode
 * estar errada: um `deleteMany` com a condição a mais apaga em silêncio
 * o que ainda fazia falta, e um script que corre ao ser importado não se
 * consegue testar.
 */

/**
 * Só se apaga o que está expirado **há mais de um dia**.
 *
 * A margem não é superstição: o relógio da base de dados e o de quem
 * corre isto não são o mesmo, e um pedido em curso pode ter lido uma
 * linha um instante antes de ela expirar. Um dia custa umas linhas a
 * mais e tira a pressa toda da decisão.
 */
export const PRUNE_MARGEM_MS = 24 * 60 * 60 * 1000;

export interface PruneResultado {
    tokensDeConta: number;
    refreshTokens: number;
    sessoes: number;
}

/**
 * As condições, separadas do que as executa.
 *
 * Exportadas para que os testes possam contar exatamente o mesmo que a
 * eliminação apaga, em vez de reescreverem a condição ao lado — duas
 * escritas da mesma regra divergem, e a que divergisse estaria no teste,
 * a dar verde ao código errado.
 */
export const condicoesDePrune = (agora: Date = new Date()) => {
    const limite = new Date(agora.getTime() - PRUNE_MARGEM_MS);

    return {
        /**
         * Um token de conta é um segredo de uma utilização só: depois de
         * usado ou de expirado não abre nada. O que se passou fica no
         * `AuditLog`, que não se toca aqui.
         */
        tokensDeConta: {
            OR: [{ expires_at: { lt: limite } }, { used_at: { lt: limite } }],
        },

        /**
         * **A regra é a expiração do próprio token, e não o seu estado.**
         *
         * Um refresh token rodado ou revogado continua a servir para uma
         * coisa: se alguém o apresentar, a API sabe que existem duas
         * cópias em circulação e derruba a família inteira. Essa deteção
         * lê esta linha — sem ela, o mesmo ataque passa a dar apenas
         * "token inválido" e a sessão a sério continua aberta.
         *
         * Apagar por estado seria o erro fácil de escrever: "já foi
         * rodado, já não serve". Serve, e é precisamente para isso.
         *
         * O que se perde é a deteção de um roubo mais velho do que o
         * próprio token. É a troca, e fica dita.
         */
        refreshTokens: { expires_at: { lt: limite } },

        /**
         * Apagar uma sessão leva os refresh tokens dela atrás, por
         * `onDelete: Cascade`. É por isso que a condição é a mesma — a
         * expiração — e não o estado: uma sessão revogada há cinco
         * minutos ainda tem tokens dentro do prazo, e apagá-la levava-os
         * também, com a deteção junto.
         */
        sessoes: { expires_at: { lt: limite } },
    };
};

/** Conta o que uma eliminação apagaria, sem apagar nada. */
export const contarParaPrune = async (
    prisma: PrismaClient,
    agora: Date = new Date(),
): Promise<PruneResultado> => {
    const onde = condicoesDePrune(agora);

    const [tokensDeConta, refreshTokens, sessoes] = await Promise.all([
        prisma.accountToken.count({ where: onde.tokensDeConta }),
        prisma.refreshToken.count({ where: onde.refreshTokens }),
        prisma.authSession.count({ where: onde.sessoes }),
    ]);

    return { tokensDeConta, refreshTokens, sessoes };
};

export const prune = async (
    prisma: PrismaClient,
    agora: Date = new Date(),
): Promise<PruneResultado> => {
    const onde = condicoesDePrune(agora);

    const tokensDeConta = await prisma.accountToken.deleteMany({
        where: onde.tokensDeConta,
    });

    const refreshTokens = await prisma.refreshToken.deleteMany({
        where: onde.refreshTokens,
    });

    /**
     * As sessões ficam para o fim: o que a cascata delas apagaria já foi
     * apagado acima pela sua própria regra, e assim as contagens dizem a
     * verdade em vez de uma levar o crédito do trabalho da outra.
     */
    const sessoes = await prisma.authSession.deleteMany({ where: onde.sessoes });

    return {
        tokensDeConta: tokensDeConta.count,
        refreshTokens: refreshTokens.count,
        sessoes: sessoes.count,
    };
};
