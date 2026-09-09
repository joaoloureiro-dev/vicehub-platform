import {
    DistributionStatus,
    entitlingSubscriptionFilter,
    TransactionStatus,
    type DatabaseClient,
} from '@vicehub/database';

/**
 * Uma crew ou um servidor, dito pela coluna que os identifica.
 *
 * Apagar uma crew e apagar um servidor obedecem às mesmas regras e
 * mexem nas mesmas tabelas — a diferença entre os dois é uma coluna e,
 * no fim, as chaves de ingestão. Escrever isto duas vezes seria escrever
 * duas regras que teriam de ser mudadas ao mesmo tempo para sempre.
 */
export type CommunityOwner = { crewId: string } | { serverId: string };

/**
 * O que impede uma comunidade de ser apagada.
 *
 * São condições, e não avisos: cada uma delas é uma coisa que ficaria
 * inalcançável se a linha desaparecesse do sítio onde as pessoas a
 * encontram.
 */
export interface DeletionBlockers {
    /** Dinheiro parado na carteira. Apagar tornava-o inalcançável. */
    funds: bigint;

    /** Movimentos ou divisões ainda por decidir. */
    openDecisions: number;

    /**
     * Um plano próprio ainda a dar direito.
     *
     * Não se apaga o que está a ser pago — nem o que foi oferecido:
     * um plano vitalício numa crew apagada é um presente que se perde
     * sem ninguém dar por isso.
     */
    hasActivePlan: boolean;
}

export const blocksDeletion = (blockers: DeletionBlockers): boolean =>
    blockers.funds !== 0n
    || blockers.openDecisions > 0
    || blockers.hasActivePlan;

/**
 * Lê de uma vez tudo o que pode impedir a eliminação.
 */
export const findDeletionBlockers = async (
    database: DatabaseClient,
    owner: CommunityOwner,
    agora: Date = new Date(),
): Promise<DeletionBlockers> => {
    const [carteira, movimentos, divisoes, plano] = await Promise.all([
        database.wallet.findFirst({
            where: { ...owner, is_deleted: false },
            select: { balance: true },
        }),
        database.transaction.count({
            where: {
                wallet: { ...owner },
                status: TransactionStatus.pending,
                is_deleted: false,
            },
        }),
        database.distribution.count({
            where: {
                wallet: { ...owner },
                status: DistributionStatus.pending,
                is_deleted: false,
            },
        }),
        database.subscription.findFirst({
            where: { ...owner, ...entitlingSubscriptionFilter(agora) },
            select: { id: true },
        }),
    ]);

    return {
        funds: carteira?.balance ?? 0n,
        openDecisions: movimentos + divisoes,
        hasActivePlan: plano !== null,
    };
};

/**
 * Apaga a comunidade e tudo o que só existia por causa dela.
 *
 * Apagar é marcar como apagado — como em todo o resto da plataforma —
 * e vai tudo numa transação: uma crew apagada com os membros ainda
 * ativos apareceria em "as minhas comunidades" de quem lá estava, a
 * apontar para uma página que já não existe.
 *
 * As filiações vão atrás. Quando o apagado é o servidor, isso retira às
 * crews que lá jogavam o direito que vinha do plano dele — que é o que
 * tem de acontecer: o plano era do servidor, e o servidor deixou de
 * existir.
 */
export const softDeleteCommunity = async (
    database: DatabaseClient,
    owner: CommunityOwner,
    actorId: string,
): Promise<void> => {
    const agora = new Date();

    const marca = {
        is_deleted: true,
        deleted_at: agora,
        updated_by: actorId,
        version: { increment: 1 },
    };

    const principal
        = 'crewId' in owner
            ? database.crew.update({ where: { id: owner.crewId }, data: marca })
            : database.server.update({
                where: { id: owner.serverId },
                data: marca,
            });

    const emCascata = [
        database.membership.updateMany({
            where: { ...owner, is_deleted: false },
            data: marca,
        }),
        database.affiliation.updateMany({
            where: { ...owner, is_deleted: false },
            data: marca,
        }),
        database.userRole.updateMany({
            where: { ...owner, is_deleted: false },
            data: marca,
        }),
        database.event.updateMany({
            where: { ...owner, is_deleted: false },
            data: marca,
        }),
        database.wallet.updateMany({
            where: { ...owner, is_deleted: false },
            data: marca,
        }),
    ];

    /**
     * Uma chave de ingestão de um servidor apagado tem de deixar de
     * servir. Sem isto, o recurso instalado no jogo continuava a ser
     * aceite e a escrever num servidor que já ninguém encontra.
     */
    if ('serverId' in owner) {
        emCascata.push(
            database.serverApiKey.updateMany({
                where: { serverId: owner.serverId, is_deleted: false },
                data: { ...marca, revoked_at: agora },
            }),
        );
    }

    await database.$transaction([principal, ...emCascata]);
};
