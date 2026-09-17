import {
    XpReason,
    XP_DE_QUEM_APARECEU,
    nivelDoXp,
    xpDeUmEvento,
    type DatabaseClient,
} from '@vicehub/database';

import {
    grantAttendanceAchievements,
    grantCrewEventAchievements,
    grantCrewLevelAchievements,
} from './achievements.js';

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

/** A transação em curso. */
type Escritor = Parameters<
    Parameters<DatabaseClient['$transaction']>[0] extends (tx: infer T) => unknown
        ? (tx: T) => void
        : never
>[0];

/**
 * Se este ganho já existe.
 *
 * Procurar antes de escrever, em vez de escrever e apanhar o índice a
 * recusar: uma recusa derruba a transação inteira, e com ela o pagamento
 * de toda a gente que ainda faltava. O índice continua lá e continua a
 * ser a garantia que dura — isto é o que permite passar outra vez sem
 * lhe bater.
 */
const jaPago = async (
    tx: Escritor,
    chave: {
        userId?: string;
        crewId?: string;
        eventId: string;
        reason: XpReason;
    },
): Promise<boolean> => {
    const existente = await tx.xpAward.findFirst({
        where: { ...chave, is_deleted: false },
        select: { id: true },
    });

    return existente !== null;
};

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
 * **Pode ser chamada outra vez.** Cada ganho é procurado antes de ser
 * escrito, por isso repetir com a mesma lista não paga nada, e repetir
 * com uma lista maior paga só a quem ainda não tinha recebido. É o que
 * permite assentar um evento de novo quando um veredicto muda depois de
 * ele fechar — antes, uma segunda passagem batia no índice e a transação
 * inteira caía, pelo que quem fosse confirmado tarde não recebia nada.
 *
 * O que ela nunca faz é **tirar**. Uma linha de quem deixou de estar
 * confirmado fica onde está: o xp mede o que se fez, e um nível que
 * descesse por uma correção de outra pessoa seria um castigo por engano
 * alheio. Quem passa a faltoso perde reputação, que é o número que mede
 * se apareceu.
 *
 * Devolve `awarded: false` quando não havia nada por pagar.
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

    let pagos = 0;
    let crewPaga = false;

    await database.$transaction(async (tx) => {
        const crewPorPagar
            = input.crewId !== null
            && crewXp > 0
            && !(await jaPago(tx, {
                crewId: input.crewId,
                eventId: input.eventId,
                reason: XpReason.event_completed,
            }));

        if (input.crewId !== null && crewPorPagar) {
            crewPaga = true;

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

            const nivel = nivelDoXp(xp);

            await tx.crew.update({
                where: { id: input.crewId },
                data: { level: nivel },
            });

            /**
             * O nível que a crew acabou de ter, e não um que se vá
             * buscar outra vez: é o mesmo número que a linha acima
             * gravou, e lê-lo de novo seria abrir a porta a que os
             * dois discordassem.
             */
            await grantCrewLevelAchievements(
                tx,
                input.crewId,
                nivel,
                input.actorId,
            );

            /**
             * As conquistas saem da contagem das linhas de xp, que
             * acabaram de incluir esta. Na mesma transação: o
             * evento contou ou não contou, e a medalha segue o
             * mesmo destino.
             */
            await grantCrewEventAchievements(
                tx,
                input.crewId,
                input.actorId,
            );
        }

        if (userXp > 0) {
            for (const userId of input.confirmedUserIds) {
                if (
                    await jaPago(tx, {
                        userId,
                        eventId: input.eventId,
                        reason: XpReason.event_attended,
                    })
                ) {
                    continue;
                }

                pagos += 1;

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

                await grantAttendanceAchievements(
                    tx,
                    userId,
                    input.actorId,
                );
            }
        }
    });

    return {
        awarded: pagos > 0 || crewPaga,
        crewXp: crewPaga ? crewXp : 0,
        userXp,
        users: pagos,
    };
};
