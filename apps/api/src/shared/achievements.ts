import {
    DEGRAUS_DE_EVENTOS,
    DEGRAUS_DE_NIVEL_DE_CREW,
    DEGRAUS_DE_PAGAMENTOS,
    DEGRAUS_DE_PRESENCAS,
    DistributionStatus,
    XpReason,
    conquistaDeEventos,
    conquistaDeNivel,
    conquistaDePagamentos,
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

/**
 * As conquistas de nível de uma crew que acabou de ganhar xp.
 *
 * O nível chega feito, e não é contado outra vez: quem chama acabou de
 * o calcular a partir do xp na mesma escrita, e recalculá-lo aqui seria
 * pedir à base de dados um número que quem pergunta já tem na mão.
 *
 * Só crews. Uma pessoa só ganha xp de uma maneira, e por isso o nível
 * dela é a contagem de presenças com outro nome — a medalha por isso já
 * existe, e dar-lhe uma segunda era premiar o mesmo facto duas vezes.
 */
export const grantCrewLevelAchievements = async (
    tx: Escritor,
    crewId: string,
    nivel: number,
    actorId: string,
): Promise<void> => {
    await gravar(
        tx,
        { crewId },
        degrausAlcancados(DEGRAUS_DE_NIVEL_DE_CREW, nivel).map(conquistaDeNivel),
        actorId,
    );
};

/**
 * As conquistas de uma crew que acabou de pagar aos seus.
 *
 * A contagem sai das divisões aprovadas, que é o facto que move o
 * dinheiro: uma divisão proposta e nunca aprovada não pagou a ninguém,
 * e contá-la era deixar uma crew ganhar a medalha por escrever
 * intenções.
 *
 * Corre dentro da transação que aprova a divisão, depois de esta já ter
 * mudado de estado — logo, esta conta-se a si própria, como no xp dos
 * eventos.
 */
export const grantCrewPayoutAchievements = async (
    tx: Escritor,
    crewId: string,
    actorId: string,
): Promise<void> => {
    const pagamentos = await (tx as DatabaseClient).distribution.count({
        where: {
            wallet: { crewId },
            status: DistributionStatus.approved,
            is_deleted: false,
        },
    });

    await gravar(
        tx,
        { crewId },
        degrausAlcancados(DEGRAUS_DE_PAGAMENTOS, pagamentos).map(
            conquistaDePagamentos,
        ),
        actorId,
    );
};
