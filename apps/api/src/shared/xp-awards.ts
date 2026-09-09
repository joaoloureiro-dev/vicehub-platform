import {
    XpReason,
    XP_DE_QUEM_APARECEU,
    nivelDoXp,
    xpDeUmEvento,
    type DatabaseClient,
} from '@vicehub/database';

import { getUniqueConstraintFields } from './prisma-errors.js';

interface EventXpInput {
    eventId: string;

    /** A crew que marcou o evento, ou null se quem o marcou foi um servidor. */
    crewId: string | null;

    /** Quem tem presença confirmada. */
    confirmedUserIds: string[];

    actorId: string;
}

export interface EventXpResultado {
    /** Falso quando já tinha sido pago, ou quando não havia nada a pagar. */
    awarded: boolean;

    /** O que foi para a crew. */
    crewXp: number;

    /** O que foi para cada pessoa que apareceu. */
    userXp: number;

    /** A quantas pessoas. */
    users: number;
}

const NADA: EventXpResultado = {
    awarded: false,
    crewXp: 0,
    userXp: 0,
    users: 0,
};

/**
 * Os ganhos de xp de um dono, do mais recente para o mais antigo.
 *
 * É a resposta a "porquê?". O total diz onde a crew está; isto diz como
 * lá chegou — e sem isto o número só se podia acreditar.
 */
export const listXpAwards = (
    database: DatabaseClient,
    owner: { crewId: string } | { userId: string },
    take: number,
) =>
    database.xpAward.findMany({
        where: { ...owner, is_deleted: false },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take,
        select: {
            id: true,
            amount: true,
            reason: true,
            created_at: true,
            event: { select: { id: true, name: true } },
        },
    });

/**
 * Paga o xp de um evento concluído.
 *
 * Escrever o ganho e somá-lo ao dono vai na mesma transação: um ganho
 * gravado sem a soma seria xp que ninguém tem, e uma soma sem o ganho
 * seria xp sem explicação — e, pior, xp que voltaria a ser pago à
 * próxima, porque é o ganho gravado que impede a repetição.
 *
 * O nível é recalculado a partir do xp na mesma escrita. Não é uma
 * segunda verdade: é a mesma, guardada para o diretório poder ordenar
 * por ela sem contar tudo outra vez.
 *
 * Devolve `awarded: false` quando este evento já tinha pago. Não é um
 * erro — é a resposta certa a alguém que concluiu o mesmo evento duas
 * vezes.
 */
export const awardEventXp = async (
    database: DatabaseClient,
    input: EventXpInput,
): Promise<EventXpResultado> => {
    const presencas = input.confirmedUserIds.length;

    const crewXp = input.crewId === null ? 0 : xpDeUmEvento(presencas);

    /**
     * Quem apareceu só ganha se o evento tiver valido alguma coisa. A
     * mesma regra dos dois: um evento a que só foi uma pessoa não paga
     * a ninguém, nem sequer a essa.
     */
    const userXp = xpDeUmEvento(presencas) === 0 ? 0 : XP_DE_QUEM_APARECEU;

    if (crewXp === 0 && userXp === 0) {
        return NADA;
    }

    try {
        await database.$transaction(async (tx) => {
            if (input.crewId !== null && crewXp > 0) {
                await tx.xpAward.create({
                    data: {
                        crewId: input.crewId,
                        eventId: input.eventId,
                        reason: XpReason.event_completed,
                        amount: crewXp,
                        created_by: input.actorId,
                    },
                });

                const { xp } = await tx.crew.update({
                    where: { id: input.crewId },
                    data: {
                        xp: { increment: BigInt(crewXp) },
                        version: { increment: 1 },
                    },
                    select: { xp: true },
                });

                await tx.crew.update({
                    where: { id: input.crewId },
                    data: { level: nivelDoXp(xp) },
                });
            }

            if (userXp > 0) {
                for (const userId of input.confirmedUserIds) {
                    await tx.xpAward.create({
                        data: {
                            userId,
                            eventId: input.eventId,
                            reason: XpReason.event_attended,
                            amount: userXp,
                            created_by: input.actorId,
                        },
                    });

                    const { xp } = await tx.user.update({
                        where: { id: userId },
                        data: {
                            xp: { increment: BigInt(userXp) },
                            version: { increment: 1 },
                        },
                        select: { xp: true },
                    });

                    await tx.user.update({
                        where: { id: userId },
                        data: { level: nivelDoXp(xp) },
                    });
                }
            }
        });
    } catch (erro) {
        /**
         * O índice recusou: este evento já pagou. Nada foi escrito —
         * a transação inteira caiu com ele.
         */
        if (getUniqueConstraintFields(erro) === null) {
            throw erro;
        }

        return NADA;
    }

    return {
        awarded: true,
        crewXp,
        userXp,
        users: userXp > 0 ? presencas : 0,
    };
};
