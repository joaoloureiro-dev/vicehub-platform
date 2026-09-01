import type { FastifyReply, FastifyRequest } from 'fastify';

import { EventStatus } from '@vicehub/database';

import { AuditService } from '../../audit/services/audit.service.js';
import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import type {
    ConfirmAttendanceDto,
    CreateEventDto,
    EventIdParamDto,
    EventParticipantParamDto,
    EventTransitionDto,
    ListEventsQueryDto,
    UpdateEventDto,
} from '../dto/event.dto.js';
import { EventError } from '../errors/event.errors.js';
import type { EventService } from '../services/event.service.js';
import type {
    EventOwner,
    EventParticipantEntry,
    EventSummary,
} from '../types/event.types.js';

interface OwnerParams {
    crewId?: string | undefined;
    serverId?: string | undefined;
}

export class EventController {
    constructor(
        private readonly eventService: EventService,
        private readonly auditService: AuditService,
    ) { }

    async create(
        request: FastifyRequest<{ Body: CreateEventDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const evento = await this.eventService.createEvent(this.ownerOf(request), {
            ...request.body,
            organizerId: user.id,
        });

        await this.auditService.record({
            actorId: user.id,
            action: 'event.created',
            entityType: 'Event',
            entityId: evento.id,
            after: { name: evento.name, startsAt: evento.startsAt.toISOString() },
            ...AuditService.contextOf(request),
        });

        reply.code(201).send(this.toDto(evento));
    }

    async list(
        request: FastifyRequest<{ Querystring: ListEventsQueryDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const eventos = await this.eventService.listEvents(this.ownerOf(request), {
            status: this.statusOf(request.query.status),
            includePast: request.query.includePast,
            limit: request.query.limit,
        });

        reply.send(eventos.map((evento) => this.toDto(evento)));
    }

    async get(
        request: FastifyRequest<{ Params: EventIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        reply.send(
            this.toDto(
                await this.eventService.getEvent(
                    this.ownerOf(request),
                    request.params.eventId,
                ),
            ),
        );
    }

    async update(
        request: FastifyRequest<{ Params: EventIdParamDto; Body: UpdateEventDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const evento = await this.eventService.updateEvent(
            this.ownerOf(request),
            request.params.eventId,
            request.body,
            user.id,
        );

        reply.send(this.toDto(evento));
    }

    async transition(
        request: FastifyRequest<{ Params: EventIdParamDto; Body: EventTransitionDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const evento = await this.eventService.transition(
            this.ownerOf(request),
            request.params.eventId,
            request.body.status,
            user.id,
        );

        await this.auditService.record({
            actorId: user.id,
            action: `event.${request.body.status}`,
            entityType: 'Event',
            entityId: evento.id,
            after: { status: evento.status },
            ...AuditService.contextOf(request),
        });

        reply.send(this.toDto(evento));
    }

    async signUp(
        request: FastifyRequest<{ Params: EventIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.eventService.signUp(
            this.ownerOf(request),
            request.params.eventId,
            user.id,
        );

        reply.status(204).send();
    }

    async withdraw(
        request: FastifyRequest<{ Params: EventIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.eventService.withdraw(
            this.ownerOf(request),
            request.params.eventId,
            user.id,
        );

        reply.status(204).send();
    }

    async listParticipants(
        request: FastifyRequest<{ Params: EventIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const participantes = await this.eventService.listParticipants(
            this.ownerOf(request),
            request.params.eventId,
        );

        reply.send(participantes.map((entry) => this.toParticipantDto(entry)));
    }

    /**
     * Confirmar a presença é o que dá direito a receber, e por isso fica
     * no rasto de auditoria com o peso atribuído.
     */
    async confirmAttendance(
        request: FastifyRequest<{
            Params: EventParticipantParamDto;
            Body: ConfirmAttendanceDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const weight = request.body.weight ?? 1;

        await this.eventService.confirmAttendance(
            this.ownerOf(request),
            request.params.eventId,
            request.params.userId,
            weight,
            user.id,
        );

        await this.auditService.record({
            actorId: user.id,
            action: 'event.attendance.confirmed',
            entityType: 'Event',
            entityId: request.params.eventId,
            after: { userId: request.params.userId, weight },
            ...AuditService.contextOf(request),
        });

        reply.status(204).send();
    }

    async markNoShow(
        request: FastifyRequest<{ Params: EventParticipantParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.eventService.markNoShow(
            this.ownerOf(request),
            request.params.eventId,
            request.params.userId,
            user.id,
        );

        await this.auditService.record({
            actorId: user.id,
            action: 'event.attendance.revoked',
            entityType: 'Event',
            entityId: request.params.eventId,
            after: { userId: request.params.userId, status: 'no_show' },
            ...AuditService.contextOf(request),
        });

        reply.status(204).send();
    }

    /**
     * Lê o titular do próprio caminho da rota.
     *
     * As rotas são registadas duas vezes, com prefixo de crew e de
     * servidor, e é o parâmetro presente que diz de quem é o evento. É a
     * mesma convenção que o guard de autorização usa para saber em que
     * âmbito avaliar a permissão, pelo que os dois não podem discordar.
     */
    private ownerOf(request: FastifyRequest): EventOwner {
        const params = (request.params ?? {}) as OwnerParams;

        if (typeof params.crewId === 'string') {
            return { crewId: params.crewId };
        }

        if (typeof params.serverId === 'string') {
            return { serverId: params.serverId };
        }

        throw new EventError(
            'INVALID_EVENT_OWNER',
            'Esta rota não indica a que crew ou servidor pertence o evento.',
        );
    }

    /**
     * O filtro chega validado pelo schema, mas como texto.
     */
    private statusOf(status: string | undefined): EventStatus | undefined {
        return status === undefined ? undefined : (status as EventStatus);
    }

    private toDto(evento: EventSummary) {
        return {
            ...evento,
            startsAt: evento.startsAt.toISOString(),
            endsAt: evento.endsAt?.toISOString() ?? null,
            createdAt: evento.createdAt.toISOString(),
        };
    }

    private toParticipantDto(entry: EventParticipantEntry) {
        return {
            ...entry,
            confirmedAt: entry.confirmedAt?.toISOString() ?? null,
            signedUpAt: entry.signedUpAt.toISOString(),
        };
    }
}
