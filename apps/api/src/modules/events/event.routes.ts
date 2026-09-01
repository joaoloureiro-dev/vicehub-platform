import type { FastifyPluginAsync } from 'fastify';

import type { EventController } from './controllers/event.controller.js';
import type {
    ConfirmAttendanceDto,
    CreateEventDto,
    EventIdParamDto,
    EventParticipantParamDto,
    EventTransitionDto,
    ListEventsQueryDto,
    UpdateEventDto,
} from './dto/event.dto.js';
import {
    confirmAttendanceSchema,
    createEventSchema,
    eventIdParamSchema,
    eventParticipantParamSchema,
    eventTransitionSchema,
    listEventsQuerySchema,
    updateEventSchema,
} from './schemas/event.schemas.js';

interface EventRoutesOptions {
    controller: EventController;
}

interface OwnerEventRoutesOptions extends EventRoutesOptions {
    /**
     * A quem pertencem os eventos destas rotas. Decide que parâmetro de
     * âmbito os schemas têm de aceitar — e portanto preservar.
     */
    kind: 'crew' | 'server';
}

/**
 * Rotas de eventos de um titular.
 *
 * Registadas duas vezes, com prefixo `/crews/:crewId` e
 * `/servers/:serverId`: as regras são as mesmas e escrevê-las duas vezes
 * faria com que uma correção só entrasse numa delas. O parâmetro do
 * prefixo é lido pelo guard de autorização para saber em que âmbito
 * avaliar a permissão — um cargo noutra crew nunca autoriza nada nesta.
 */
const ownerEventRoutes: FastifyPluginAsync<OwnerEventRoutesOptions> = async (
    fastify,
    options,
) => {
    const { controller, kind } = options;

    /**
     * Os schemas são construídos para o titular destas rotas, e incluem
     * sempre o parâmetro de âmbito: o Zod descarta o que não declara, e
     * é desse parâmetro que o guard de autorização lê o âmbito.
     */
    const eventParams = eventIdParamSchema(kind);
    const participantParams = eventParticipantParamSchema(kind);

    /**
     * Ver eventos exige `event:read`, que qualquer membro tem. Não é
     * público como o diretório de crews: o calendário de uma comunidade
     * diz quando e onde ela vai estar, e isso é dela.
     */
    fastify.get<{ Querystring: ListEventsQueryDto }>(
        '/',
        {
            preHandler: [fastify.authenticate, fastify.authorize('event:read')],
            schema: { querystring: listEventsQuerySchema },
        },
        controller.list.bind(controller),
    );

    fastify.post<{ Body: CreateEventDto }>(
        '/',
        {
            preHandler: [fastify.authenticate, fastify.authorize('event:manage')],
            schema: { body: createEventSchema },
        },
        controller.create.bind(controller),
    );

    fastify.get<{ Params: EventIdParamDto }>(
        '/:eventId',
        {
            preHandler: [fastify.authenticate, fastify.authorize('event:read')],
            schema: { params: eventParams },
        },
        controller.get.bind(controller),
    );

    fastify.patch<{ Params: EventIdParamDto; Body: UpdateEventDto }>(
        '/:eventId',
        {
            preHandler: [fastify.authenticate, fastify.authorize('event:manage')],
            schema: { params: eventParams, body: updateEventSchema },
        },
        controller.update.bind(controller),
    );

    /**
     * Começar, concluir e cancelar são a mesma operação com destinos
     * diferentes, e por isso uma só rota: transições novas não precisam
     * de rotas novas, e o que é permitido lê-se num sítio só.
     */
    fastify.post<{ Params: EventIdParamDto; Body: EventTransitionDto }>(
        '/:eventId/status',
        {
            preHandler: [fastify.authenticate, fastify.authorize('event:manage')],
            schema: { params: eventParams, body: eventTransitionSchema },
        },
        controller.transition.bind(controller),
    );

    /**
     * Inscrever-se e desistir dizem respeito ao próprio: exigem conta,
     * mas nenhuma permissão de gestão. O serviço é que verifica que quem
     * se inscreve pertence mesmo à crew ou ao servidor.
     */
    fastify.post<{ Params: EventIdParamDto }>(
        '/:eventId/signup',
        {
            preHandler: [fastify.authenticate],
            schema: { params: eventParams },
        },
        controller.signUp.bind(controller),
    );

    fastify.delete<{ Params: EventIdParamDto }>(
        '/:eventId/signup',
        {
            preHandler: [fastify.authenticate],
            schema: { params: eventParams },
        },
        controller.withdraw.bind(controller),
    );

    fastify.get<{ Params: EventIdParamDto }>(
        '/:eventId/participants',
        {
            preHandler: [fastify.authenticate, fastify.authorize('event:read')],
            schema: { params: eventParams },
        },
        controller.listParticipants.bind(controller),
    );

    /**
     * Confirmar uma presença é o que dá direito a receber parte dos
     * ganhos, e por isso exige uma permissão própria — `event:manage`
     * não chega. Quem organiza um evento não decide sozinho quem é pago
     * por ele a não ser que a comunidade lhe tenha dado também isso.
     */
    fastify.post<{ Params: EventParticipantParamDto; Body: ConfirmAttendanceDto }>(
        '/:eventId/participants/:userId/confirm',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('event:confirm_attendance'),
            ],
            schema: {
                params: participantParams,
                body: confirmAttendanceSchema,
            },
        },
        controller.confirmAttendance.bind(controller),
    );

    fastify.post<{ Params: EventParticipantParamDto }>(
        '/:eventId/participants/:userId/no-show',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('event:confirm_attendance'),
            ],
            schema: { params: participantParams },
        },
        controller.markNoShow.bind(controller),
    );
};

/**
 * Rotas do módulo de eventos.
 */
const eventRoutes: FastifyPluginAsync<EventRoutesOptions> = async (
    fastify,
    options,
) => {
    await fastify.register(ownerEventRoutes, {
        prefix: '/crews/:crewId',
        controller: options.controller,
        kind: 'crew',
    });

    await fastify.register(ownerEventRoutes, {
        prefix: '/servers/:serverId',
        controller: options.controller,
        kind: 'server',
    });
};

export default eventRoutes;
