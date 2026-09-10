import {
    DEGRAUS_DE_EVENTOS,
    DEGRAUS_DE_PRESENCAS,
    XpReason,
    conquistaDeEventos,
    conquistaDePresencas,
    degrausAlcancados,
    type DatabaseClient,
} from '@vicehub/database';

/** A transação em curso, ou a base de dados quando não há nenhuma. */
type Escritor = DatabaseClient | Parameters<
    Parameters<DatabaseClient['$transaction']>[0] extends (tx: infer T) => unknown
        ? (tx: T) => void
        : never
>[0];

/**
 * Grava as conquistas que uma contagem acaba de alcançar.
 *
 * `skipDuplicates` não é uma comodidade — é o que impede um desastre.
 *
 * Isto corre dentro da mesma transação que paga o xp do evento. Uma
 * conquista repetida é o caso **normal**: quem apareceu ao seu décimo
 * evento já tinha a de um evento. Se essa segunda escrita rebentasse
 * contra o índice, levava a transação inteira com ela — e o xp do
 * evento desaparecia por causa de uma medalha.
 *
 * Escrever com `ON CONFLICT DO NOTHING`, que é o que isto gera, também
 * evita o "ler primeiro, escrever depois": dois eventos a concluir ao
 * mesmo tempo veriam ambos a conquista em falta, e um deles rebentava.
 */
const gravar = async (
    tx: Escritor,
    dono: { userId: string } | { crewId: string },
    slugs: string[],
    actorId: string,
): Promise<void> => {
    if (slugs.length === 0) {
        return;
    }

    await (tx as DatabaseClient).achievement.createMany({
        data: slugs.map((slug) => ({ ...dono, slug, created_by: actorId })),
        skipDuplicates: true,
    });
};

/**
 * As conquistas de quem apareceu a um evento que acabou de contar.
 *
 * A contagem sai das linhas de xp, e não de um contador guardado: é o
 * mesmo facto que já prova que a pessoa apareceu, e um contador à parte
 * seria uma segunda verdade sobre a mesma coisa.
 */
export const grantAttendanceAchievements = async (
    tx: Escritor,
    userId: string,
    actorId: string,
): Promise<void> => {
    const presencas = await (tx as DatabaseClient).xpAward.count({
        where: {
            userId,
            reason: XpReason.event_attended,
            is_deleted: false,
        },
    });

    await gravar(
        tx,
        { userId },
        degrausAlcancados(DEGRAUS_DE_PRESENCAS, presencas).map(conquistaDePresencas),
        actorId,
    );
};

/**
 * As conquistas de uma crew que acabou de concluir um evento.
 */
export const grantCrewEventAchievements = async (
    tx: Escritor,
    crewId: string,
    actorId: string,
): Promise<void> => {
    const eventos = await (tx as DatabaseClient).xpAward.count({
        where: {
            crewId,
            reason: XpReason.event_completed,
            is_deleted: false,
        },
    });

    await gravar(
        tx,
        { crewId },
        degrausAlcancados(DEGRAUS_DE_EVENTOS, eventos).map(conquistaDeEventos),
        actorId,
    );
};
