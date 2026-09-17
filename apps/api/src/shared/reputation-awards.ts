import {
    ReputationReason,
    EventParticipantStatus,
    reputacaoDe,
    type DatabaseClient,
} from '@vicehub/database';

import { getUniqueConstraintFields } from './prisma-errors.js';

/** Um desfecho de participação, já reduzido ao que a reputação precisa. */
export interface DesfechoDeParticipacao {
    userId: string;
    status: EventParticipantStatus;
}

export interface ReputationInput {
    eventId: string;

    /** Toda a gente sobre quem o evento se pronunciou. */
    participantes: DesfechoDeParticipacao[];

    actorId: string;
}

export interface ReputationResultado {
    /** Falso quando já tinha sido registado, ou não havia nada a registar. */
    awarded: boolean;

    /** A quantas pessoas subiu. */
    presencas: number;

    /** A quantas desceu. */
    faltas: number;
}

const NADA: ReputationResultado = {
    awarded: false,
    presencas: 0,
    faltas: 0,
};

/**
 * A razão que corresponde a um valor.
 *
 * Sai do sinal e não do estado outra vez: a regra de quanto vale cada
 * desfecho vive num sítio só, em `@vicehub/database`, e ler o estado
 * aqui de novo seria abrir a porta a que os dois discordassem.
 */
const razaoDe = (valor: number): ReputationReason =>
    valor > 0 ? ReputationReason.event_attended : ReputationReason.event_missed;

/**
 * A reputação de um evento concluído.
 *
 * Escrever a linha e somá-la à pessoa vai na mesma transação, pela mesma
 * razão que no xp: uma linha sem a soma seria reputação que ninguém tem,
 * e uma soma sem a linha seria um número sem explicação — e que voltaria
 * a ser contado à próxima, porque é a linha gravada que impede a
 * repetição.
 *
 * Isto corre quando o evento é concluído, e não a cada confirmação:
 * enquanto o evento decorre ainda se confirma e se desmarca gente, e
 * mexer na reputação a cada mudança seria mexer numa lista que ainda
 * está a mudar. No fim há uma lista só, e é essa que conta.
 *
 * A reputação **pode descer abaixo de zero**, e é deliberado. Um chão em
 * zero faria a soma das linhas deixar de ser o número — duas verdades
 * sobre a mesma coisa —, e apagaria a diferença entre quem nunca foi a
 * nada e quem falta a tudo a que se inscreve. É precisamente essa
 * diferença que se quer mostrar a quem decide aceitar alguém numa crew.
 */
export const awardEventReputation = async (
    database: DatabaseClient,
    input: ReputationInput,
): Promise<ReputationResultado> => {
    const mudancas = input.participantes
        .map((participante) => ({
            userId: participante.userId,
            valor: reputacaoDe(participante.status),
        }))
        .filter((mudanca) => mudanca.valor !== 0);

    if (mudancas.length === 0) {
        return NADA;
    }

    try {
        await database.$transaction(async (tx) => {
            for (const mudanca of mudancas) {
                await tx.reputationAward.create({
                    data: {
                        userId: mudanca.userId,
                        eventId: input.eventId,
                        reason: razaoDe(mudanca.valor),
                        amount: mudanca.valor,
                        created_by: input.actorId,
                    },
                });

                await tx.user.update({
                    where: { id: mudanca.userId },
                    data: {
                        reputation: { increment: mudanca.valor },
                        version: { increment: 1 },
                    },
                });
            }
        });
    } catch (erro) {
        /**
         * O índice recusou: este evento já tinha sido contado. Nada foi
         * escrito — a transação inteira caiu com ele.
         */
        if (getUniqueConstraintFields(erro) === null) {
            throw erro;
        }

        return NADA;
    }

    return {
        awarded: true,
        presencas: mudancas.filter((mudanca) => mudanca.valor > 0).length,
        faltas: mudancas.filter((mudanca) => mudanca.valor < 0).length,
    };
};

/**
 * As mudanças de reputação de alguém, da mais recente para a mais antiga.
 *
 * É a resposta a "porquê?". O total diz onde a pessoa está; isto diz
 * como lá chegou.
 */
export const listReputationAwards = (
    database: DatabaseClient,
    userId: string,
    take: number,
) =>
    database.reputationAward.findMany({
        where: { userId, is_deleted: false },
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
