import {
    EventParticipantStatus,
    EventStatus,
    MembershipStatus,
    MembershipType,
    SourceType,
    type DatabaseClient,
} from '@vicehub/database';

import type { EventOwner } from '../types/event.types.js';

interface CreateEventInput {
    owner: EventOwner;
    name: string;
    description?: string | null | undefined;
    startsAt: Date;
    endsAt?: Date | null | undefined;
    capacity?: number | null | undefined;
    organizerId: string;
}

interface UpdateEventInput {
    name?: string | undefined;
    description?: string | null | undefined;
    startsAt?: Date | undefined;
    endsAt?: Date | null | undefined;
    capacity?: number | null | undefined;
}

/**
 * Estados em que alguém ocupa lugar no evento.
 *
 * Quem desistiu ou faltou não ocupa: contá-los faria um evento com
 * lotação esgotada por causa de quem já disse que não vai.
 */
const OCCUPYING_STATUSES = [
    EventParticipantStatus.signed_up,
    EventParticipantStatus.confirmed,
] as const;

/**
 * Repositório do módulo de eventos.
 */
export class EventRepository {
    constructor(private readonly database: DatabaseClient) { }

    findById(eventId: string) {
        return this.database.event.findFirst({
            where: { id: eventId, is_deleted: false },
        });
    }

    createEvent(input: CreateEventInput) {
        const data: {
            crewId: string | null;
            serverId: string | null;
            name: string;
            starts_at: Date;
            organizer_id: string;
            source: SourceType;
            created_by: string;
            description?: string | null;
            ends_at?: Date | null;
            capacity?: number | null;
        } = {
            crewId: input.owner.crewId ?? null,
            serverId: input.owner.serverId ?? null,
            name: input.name,
            starts_at: input.startsAt,
            organizer_id: input.organizerId,
            source: SourceType.api,
            created_by: input.organizerId,
        };

        /**
         * Chaves ausentes ficam ausentes: com exactOptionalPropertyTypes,
         * passar undefined ao Prisma seria rejeitado pelo compilador.
         */
        if (input.description !== undefined) {
            data.description = input.description;
        }

        if (input.endsAt !== undefined) {
            data.ends_at = input.endsAt;
        }

        if (input.capacity !== undefined) {
            data.capacity = input.capacity;
        }

        return this.database.event.create({ data });
    }

    updateEvent(eventId: string, input: UpdateEventInput, updatedBy: string) {
        const data: {
            version: { increment: number };
            updated_by: string;
            name?: string;
            description?: string | null;
            starts_at?: Date;
            ends_at?: Date | null;
            capacity?: number | null;
        } = { version: { increment: 1 }, updated_by: updatedBy };

        if (input.name !== undefined) {
            data.name = input.name;
        }

        if (input.description !== undefined) {
            data.description = input.description;
        }

        if (input.startsAt !== undefined) {
            data.starts_at = input.startsAt;
        }

        if (input.endsAt !== undefined) {
            data.ends_at = input.endsAt;
        }

        if (input.capacity !== undefined) {
            data.capacity = input.capacity;
        }

        return this.database.event.update({ where: { id: eventId }, data });
    }

    /**
     * Muda o estado do evento **apenas se ainda estiver no que se
     * esperava**.
     *
     * A condição vai no where e não numa leitura anterior: dois pedidos
     * simultâneos a fechar o mesmo evento fariam ambos passar a
     * verificação e o segundo reabriria decisões já tomadas. Assim, o
     * segundo não encontra linha e sabe que chegou tarde.
     */
    async transitionStatus(
        eventId: string,
        from: EventStatus[],
        to: EventStatus,
        changedBy: string,
    ): Promise<boolean> {
        const resultado = await this.database.event.updateMany({
            where: { id: eventId, is_deleted: false, status: { in: from } },
            data: { status: to, updated_by: changedBy, version: { increment: 1 } },
        });

        return resultado.count === 1;
    }

    listForOwner(input: {
        owner: EventOwner;
        status?: EventStatus | undefined;
        notBefore?: Date | undefined;
        take: number;
    }) {
        const where = {
            crewId: input.owner.crewId ?? null,
            serverId: input.owner.serverId ?? null,
            is_deleted: false,
            ...(input.status ? { status: input.status } : {}),
            ...(input.notBefore ? { starts_at: { gte: input.notBefore } } : {}),
        };

        return this.database.event.findMany({
            where,
            /**
             * O id desempata: sem uma ordem total, dois eventos à mesma
             * hora podiam trocar de posição entre pedidos.
             */
            orderBy: [{ starts_at: 'asc' }, { id: 'asc' }],
            take: input.take,
        });
    }

    /**
     * Conta, de uma só vez, os inscritos e os confirmados de vários
     * eventos.
     *
     * Uma consulta para a lista inteira, em vez de uma por evento.
     */
    countParticipantsFor(eventIds: string[]) {
        return this.database.eventParticipant.groupBy({
            by: ['eventId', 'status'],
            where: {
                eventId: { in: eventIds },
                is_deleted: false,
                status: { in: [...OCCUPYING_STATUSES] },
            },
            _count: { _all: true },
        });
    }

    /**
     * Quantos lugares estão ocupados neste evento.
     */
    countOccupied(eventId: string) {
        return this.database.eventParticipant.count({
            where: {
                eventId,
                is_deleted: false,
                status: { in: [...OCCUPYING_STATUSES] },
            },
        });
    }

    findParticipant(eventId: string, userId: string) {
        return this.database.eventParticipant.findFirst({
            where: { eventId, userId, is_deleted: false },
        });
    }

    /**
     * Inscreve alguém, reaproveitando a linha de quem já se inscreveu
     * antes.
     *
     * A chave única por evento e utilizador é o que torna isto seguro
     * sob concorrência: dois pedidos simultâneos não criam duas
     * inscrições, o segundo atualiza a que o primeiro criou.
     */
    signUp(eventId: string, userId: string) {
        return this.database.eventParticipant.upsert({
            where: { eventId_userId: { eventId, userId } },
            create: {
                eventId,
                userId,
                status: EventParticipantStatus.signed_up,
                source: SourceType.api,
                created_by: userId,
            },
            update: {
                status: EventParticipantStatus.signed_up,
                is_deleted: false,
                deleted_at: null,
                /**
                 * Voltar a inscrever-se apaga uma confirmação anterior:
                 * a presença passa a ser afirmada de novo por quem
                 * organiza, e não herdada de uma ida anterior.
                 */
                confirmed_by: null,
                confirmed_at: null,
                weight: 1,
                updated_by: userId,
                version: { increment: 1 },
            },
        });
    }

    setParticipantStatus(input: {
        participantId: string;
        status: EventParticipantStatus;
        weight?: number | undefined;
        confirmedBy?: string | null | undefined;
        changedBy: string;
    }) {
        const data: {
            status: EventParticipantStatus;
            updated_by: string;
            version: { increment: number };
            weight?: number;
            confirmed_by?: string | null;
            confirmed_at?: Date | null;
        } = {
            status: input.status,
            updated_by: input.changedBy,
            version: { increment: 1 },
        };

        if (input.weight !== undefined) {
            data.weight = input.weight;
        }

        /**
         * A confirmação é sempre gravada em par — quem e quando —,
         * porque a base de dados exige os dois com um CHECK: uma
         * presença sem autor não seria auditável.
         */
        if (input.confirmedBy !== undefined) {
            data.confirmed_by = input.confirmedBy;
            data.confirmed_at = input.confirmedBy === null ? null : new Date();
        }

        return this.database.eventParticipant.update({
            where: { id: input.participantId },
            data,
        });
    }

    listParticipants(eventId: string) {
        return this.database.eventParticipant.findMany({
            where: { eventId, is_deleted: false },
            orderBy: { created_at: 'asc' },
            select: {
                status: true,
                weight: true,
                confirmed_by: true,
                confirmed_at: true,
                created_at: true,
                user: { select: { id: true, username: true, avatarUrl: true } },
            },
        });
    }

    /**
     * Quem tem presença confirmada, por ordem de inscrição.
     *
     * A ordem importa: é ela que desempata os restos da divisão, e sem
     * uma ordem estável a mesma divisão daria contas diferentes.
     */
    listConfirmedParticipants(eventId: string) {
        return this.database.eventParticipant.findMany({
            where: {
                eventId,
                is_deleted: false,
                status: EventParticipantStatus.confirmed,
            },
            orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
            select: { userId: true, weight: true },
        });
    }

    /**
     * Confirma que alguém pertence à crew ou ao servidor do evento.
     *
     * Sem isto, qualquer pessoa com conta se inscrevia nos eventos de
     * uma crew a que não pertence — e, uma vez confirmada, recebia parte
     * dos ganhos dela.
     */
    async isActiveMember(owner: EventOwner, userId: string): Promise<boolean> {
        const adesao = await this.database.membership.findFirst({
            where: {
                userId,
                crewId: owner.crewId ?? null,
                serverId: owner.serverId ?? null,
                type: owner.crewId ? MembershipType.crew : MembershipType.server,
                status: MembershipStatus.active,
                is_deleted: false,
            },
            select: { id: true },
        });

        return adesao !== null;
    }
}
