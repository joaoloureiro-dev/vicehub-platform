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

    /** Toda a gente que participou, no estado em que ficou. */
    participantes: DesfechoDeParticipacao[];

    actorId: string;
}

export interface ReputationResultado {
    /** A quantas pessoas subiu. */
    presencas: number;

    /** A quantas desceu. */
    faltas: number;
}

/**
 * A razão que corresponde a um valor.
 *
 * Sai do sinal e não do estado outra vez: a regra de quanto vale cada
 * desfecho vive num sítio só, em `@vicehub/database`, e ler o estado
 * aqui de novo seria abrir a porta a que os dois discordassem.
 */
const razaoDe = (valor: number): ReputationReason =>
    valor > 0 ? ReputationReason.event_attended : ReputationReason.event_missed;

/** A transação em curso. */
type Escritor = Parameters<
    Parameters<DatabaseClient['$transaction']>[0] extends (tx: infer T) => unknown
        ? (tx: T) => void
        : never
>[0];

/**
 * Põe a reputação de uma pessoa neste evento no valor que ela deve ter.
 *
 * Não é "somar": é **assentar**. O que o evento diz sobre alguém pode
 * mudar depois de dito — quem organiza confirma uma presença e mais
 * tarde percebe que a pessoa não esteve lá —, e uma função que só
 * somasse deixava a correção sem efeito ou contava-a duas vezes.
 *
 * Por isso a linha é uma só por pessoa e evento, e é ela que muda. A
 * pessoa leva a diferença entre o que a linha dizia e o que passa a
 * dizer, e não o valor novo: somar o valor novo por cima de uma linha
 * que já tinha contado dava o dobro.
 *
 * Devolve a diferença aplicada, que é zero quando não havia nada a
 * mudar.
 */
const assentar = async (
    tx: Escritor,
    entrada: {
        userId: string;
        eventId: string;
        valor: number;
        actorId: string;
    },
): Promise<number> => {
    const existente = await tx.reputationAward.findFirst({
        where: {
            userId: entrada.userId,
            eventId: entrada.eventId,
            is_deleted: false,
        },
        select: { id: true, amount: true },
    });

    const anterior = existente?.amount ?? 0;
    const diferenca = entrada.valor - anterior;

    if (diferenca === 0) {
        return 0;
    }

    if (existente === null) {
        await tx.reputationAward.create({
            data: {
                userId: entrada.userId,
                eventId: entrada.eventId,
                reason: razaoDe(entrada.valor),
                amount: entrada.valor,
                created_by: entrada.actorId,
            },
        });
    } else if (entrada.valor === 0) {
        /**
         * O evento deixou de ter alguma coisa a dizer sobre esta pessoa.
         *
         * A linha é marcada como apagada em vez de desaparecer: o
         * registo de que já houve um veredicto, e qual, é precisamente o
         * que uma correção não deve destruir. O índice único ignora as
         * linhas apagadas, por isso o lugar volta a ficar livre.
         */
        await tx.reputationAward.update({
            where: { id: existente.id },
            data: {
                is_deleted: true,
                deleted_at: new Date(),
                updated_by: entrada.actorId,
                version: { increment: 1 },
            },
        });
    } else {
        await tx.reputationAward.update({
            where: { id: existente.id },
            data: {
                amount: entrada.valor,
                reason: razaoDe(entrada.valor),
                updated_by: entrada.actorId,
                version: { increment: 1 },
            },
        });
    }

    await tx.user.update({
        where: { id: entrada.userId },
        data: {
            reputation: { increment: diferenca },
            version: { increment: 1 },
        },
    });

    return diferenca;
};

/**
 * A reputação de um evento, para toda a gente que participou.
 *
 * Corre quando o evento é concluído, e outra vez sempre que um
 * veredicto mude depois disso. Chamá-la de novo com os mesmos desfechos
 * não muda nada: cada pessoa já está no valor que lhe corresponde.
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
    let presencas = 0;
    let faltas = 0;

    await database.$transaction(async (tx) => {
        for (const participante of input.participantes) {
            const valor = reputacaoDe(participante.status);

            await assentar(tx, {
                userId: participante.userId,
                eventId: input.eventId,
                valor,
                actorId: input.actorId,
            });

            if (valor > 0) {
                presencas += 1;
            } else if (valor < 0) {
                faltas += 1;
            }
        }
    });

    return { presencas, faltas };
};

/**
 * Assenta a reputação de uma pessoa só.
 *
 * Existe para o veredicto que chega **depois** de o evento fechar. Até
 * aqui, confirmar uma presença num evento já concluído mudava a linha do
 * participante e não mexia em mais nada: o organizador que fechava o
 * evento e só depois arrumava quem tinha aparecido ficava sem efeito
 * nenhum, e sem nada no ecrã que o dissesse.
 *
 * Lê o estado da base de dados em vez de o receber: quem chama acabou de
 * o escrever, e passá-lo à mão abria a porta a assentar um veredicto que
 * a tabela não tem.
 */
export const settleParticipantReputation = async (
    database: DatabaseClient,
    entrada: { eventId: string; userId: string; actorId: string },
): Promise<number> => {
    const tentar = async (): Promise<number> =>
        database.$transaction(async (tx) => {
            const participante = await tx.eventParticipant.findFirst({
                where: {
                    eventId: entrada.eventId,
                    userId: entrada.userId,
                    is_deleted: false,
                },
                select: { status: true },
            });

            if (participante === null) {
                return 0;
            }

            return assentar(tx, {
                userId: entrada.userId,
                eventId: entrada.eventId,
                valor: reputacaoDe(participante.status),
                actorId: entrada.actorId,
            });
        });

    try {
        return await tentar();
    } catch (erro) {
        /**
         * O índice recusou: entre ler e escrever, alguém assentou esta
         * mesma pessoa. Uma segunda passagem encontra a linha e corrige-a
         * em vez de a criar. Uma só, porque a segunda já não tem como
         * bater no mesmo sítio.
         */
        if (getUniqueConstraintFields(erro) === null) {
            throw erro;
        }

        return tentar();
    }
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
            /**
             * O dono vem com o evento porque sem ele não há para onde
             * apontar: o endereço de um evento é o da crew ou o do
             * servidor que o marcou, e um nome sem link deixa a pergunta
             * seguinte — "qual foi esse?" — sem resposta.
             */
            event: {
                select: {
                    id: true,
                    name: true,
                    crewId: true,
                    serverId: true,
                },
            },
        },
    });
