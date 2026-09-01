import { EventParticipantStatus, EventStatus } from '@vicehub/database';

import { EventError } from '../errors/event.errors.js';
import type { EventRepository } from '../repositories/event.repository.js';
import type {
    ConfirmedParticipant,
    EventOwner,
    EventParticipantEntry,
    EventRecord,
    EventSummary,
} from '../types/event.types.js';

interface CreateEventInput {
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

interface ListEventsInput {
    status?: EventStatus | undefined;
    includePast?: boolean | undefined;
    limit: number;
}

/**
 * Transições permitidas do estado de um evento.
 *
 * Declaradas como dados, e não espalhadas por ifs, para que o que é
 * possível se leia de uma vez. O que não está aqui é recusado: um evento
 * concluído não volta a começar, e um cancelado não se conclui.
 */
const ALLOWED_TRANSITIONS: Record<
    'ongoing' | 'completed' | 'canceled',
    EventStatus[]
> = {
    ongoing: [EventStatus.scheduled],
    completed: [EventStatus.scheduled, EventStatus.ongoing],
    canceled: [EventStatus.scheduled, EventStatus.ongoing],
};

/**
 * Serviço de eventos.
 *
 * Existe para responder a uma pergunta que a tesouraria não sabia
 * responder sozinha: quem participou nisto? A inscrição e a presença são
 * mantidas distintas de propósito — quem se inscreve diz que tenciona
 * ir, e só quem organiza pode afirmar que foi. É essa afirmação, e não a
 * inscrição, que dá direito a parte dos ganhos.
 */
export class EventService {
    constructor(private readonly eventRepository: EventRepository) { }

    async createEvent(
        owner: EventOwner,
        input: CreateEventInput,
    ): Promise<EventSummary> {
        this.assertSingleOwner(owner);

        const evento = await this.eventRepository.createEvent({
            owner,
            name: input.name,
            description: input.description,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            capacity: input.capacity,
            organizerId: input.organizerId,
        });

        return this.buildSummary(evento);
    }

    async getEvent(owner: EventOwner, eventId: string): Promise<EventSummary> {
        return this.buildSummary(await this.requireEvent(owner, eventId));
    }

    async updateEvent(
        owner: EventOwner,
        eventId: string,
        input: UpdateEventInput,
        updatedBy: string,
    ): Promise<EventSummary> {
        const evento = await this.requireEvent(owner, eventId);

        /**
         * Alterar um evento já concluído ou cancelado reescreveria o
         * passado — incluindo as datas com que as presenças foram
         * confirmadas.
         */
        if (
            evento.status === EventStatus.completed ||
            evento.status === EventStatus.canceled
        ) {
            throw new EventError(
                'EVENT_ALREADY_CLOSED',
                'Este evento já terminou e não pode ser alterado.',
            );
        }

        /**
         * O início e o fim são verificados contra os valores que ficam,
         * e não apenas contra os enviados: alterar só o início podia
         * deixá-lo depois de um fim que já lá estava.
         */
        const inicio = input.startsAt ?? evento.starts_at;
        const fim = input.endsAt === undefined ? evento.ends_at : input.endsAt;

        if (fim !== null && fim < inicio) {
            throw new EventError(
                'ENDS_BEFORE_IT_STARTS',
                'O evento não pode acabar antes de começar.',
            );
        }

        await this.eventRepository.updateEvent(eventId, input, updatedBy);

        return this.getEvent(owner, eventId);
    }

    /**
     * Muda o estado do evento.
     *
     * A transição é aplicada condicionalmente na base de dados: dois
     * pedidos simultâneos a concluir o mesmo evento não o concluem duas
     * vezes, e o segundo fica a saber que chegou tarde.
     */
    async transition(
        owner: EventOwner,
        eventId: string,
        to: 'ongoing' | 'completed' | 'canceled',
        changedBy: string,
    ): Promise<EventSummary> {
        await this.requireEvent(owner, eventId);

        const aplicada = await this.eventRepository.transitionStatus(
            eventId,
            ALLOWED_TRANSITIONS[to],
            EventStatus[to],
            changedBy,
        );

        if (!aplicada) {
            throw new EventError(
                'INVALID_STATUS_TRANSITION',
                'O evento já não está num estado que permita esta mudança.',
            );
        }

        return this.getEvent(owner, eventId);
    }

    async listEvents(
        owner: EventOwner,
        input: ListEventsInput,
    ): Promise<EventSummary[]> {
        this.assertSingleOwner(owner);

        /**
         * Por omissão a lista mostra o que está para vir, que é o que
         * interessa a quem quer participar. O histórico pede-se de
         * propósito com includePast.
         */
        const eventos = await this.eventRepository.listForOwner({
            owner,
            status: input.status,
            notBefore: input.includePast === true ? undefined : new Date(),
            take: input.limit,
        });

        if (eventos.length === 0) {
            return [];
        }

        const contagens = await this.eventRepository.countParticipantsFor(
            eventos.map((evento) => evento.id),
        );

        const inscritos = new Map<string, number>();
        const confirmados = new Map<string, number>();

        for (const contagem of contagens) {
            const total = contagem._count._all;

            inscritos.set(
                contagem.eventId,
                (inscritos.get(contagem.eventId) ?? 0) + total,
            );

            if (contagem.status === EventParticipantStatus.confirmed) {
                confirmados.set(
                    contagem.eventId,
                    (confirmados.get(contagem.eventId) ?? 0) + total,
                );
            }
        }

        return eventos.map((evento) =>
            this.toSummary(
                evento,
                inscritos.get(evento.id) ?? 0,
                confirmados.get(evento.id) ?? 0,
            ),
        );
    }

    /**
     * Inscreve quem faz o pedido.
     *
     * Só membros ativos da crew ou do servidor: sem isso, qualquer conta
     * se inscrevia num evento alheio e, uma vez confirmada, recebia parte
     * dos ganhos de uma comunidade a que não pertence.
     */
    async signUp(
        owner: EventOwner,
        eventId: string,
        userId: string,
    ): Promise<void> {
        const evento = await this.requireEvent(owner, eventId);

        if (evento.status !== EventStatus.scheduled) {
            throw new EventError(
                'EVENT_NOT_SCHEDULED',
                'Só é possível inscrever-se num evento agendado.',
            );
        }

        const pertence = await this.eventRepository.isActiveMember(owner, userId);

        if (!pertence) {
            throw new EventError(
                'NOT_A_MEMBER',
                'Só quem pertence à crew ou ao servidor se pode inscrever nos seus eventos.',
            );
        }

        const existente = await this.eventRepository.findParticipant(
            eventId,
            userId,
        );

        if (
            existente &&
            (existente.status === EventParticipantStatus.signed_up ||
                existente.status === EventParticipantStatus.confirmed)
        ) {
            throw new EventError(
                'ALREADY_SIGNED_UP',
                'Já estás inscrito neste evento.',
            );
        }

        await this.assertHasRoom(evento);

        await this.eventRepository.signUp(eventId, userId);
    }

    /**
     * Retira a inscrição.
     *
     * Quem já teve a presença confirmada não desiste: a confirmação é
     * uma afirmação de quem organiza sobre o que aconteceu, e apagá-la
     * por vontade de quem participou reescreveria o registo que dá
     * direito a receber.
     */
    async withdraw(
        owner: EventOwner,
        eventId: string,
        userId: string,
    ): Promise<void> {
        await this.requireEvent(owner, eventId);

        const participante = await this.eventRepository.findParticipant(
            eventId,
            userId,
        );

        if (
            !participante ||
            participante.status !== EventParticipantStatus.signed_up
        ) {
            throw new EventError(
                'NOT_SIGNED_UP',
                'Não tens uma inscrição em aberto neste evento.',
            );
        }

        await this.eventRepository.setParticipantStatus({
            participantId: participante.id,
            status: EventParticipantStatus.withdrawn,
            changedBy: userId,
        });
    }

    /**
     * Afirma que alguém participou, e com que peso.
     *
     * É a operação que dá direito a receber, e por isso é a mais
     * sensível do módulo: exige `event:confirm_attendance` e fica
     * gravada com quem a fez e quando.
     */
    async confirmAttendance(
        owner: EventOwner,
        eventId: string,
        userId: string,
        weight: number,
        confirmedBy: string,
    ): Promise<void> {
        const evento = await this.requireEvent(owner, eventId);

        /**
         * Um evento cancelado não aconteceu, e confirmar presenças nele
         * abriria a porta a pagar por uma coisa que não houve.
         */
        if (evento.status === EventStatus.canceled) {
            throw new EventError(
                'ATTENDANCE_NOT_CONFIRMABLE',
                'Não se confirmam presenças num evento cancelado.',
            );
        }

        const participante = await this.eventRepository.findParticipant(
            eventId,
            userId,
        );

        if (!participante) {
            throw new EventError(
                'NOT_SIGNED_UP',
                'Este utilizador não se inscreveu neste evento.',
            );
        }

        await this.eventRepository.setParticipantStatus({
            participantId: participante.id,
            status: EventParticipantStatus.confirmed,
            weight,
            confirmedBy,
            changedBy: confirmedBy,
        });
    }

    /**
     * Marca alguém como ausente.
     *
     * Existe para tirar a alguém a confirmação sem apagar que se
     * inscreveu: o registo de quem disse que ia e não foi é o que
     * permite a uma comunidade decidir quem volta a ser convidado.
     */
    async markNoShow(
        owner: EventOwner,
        eventId: string,
        userId: string,
        changedBy: string,
    ): Promise<void> {
        await this.requireEvent(owner, eventId);

        const participante = await this.eventRepository.findParticipant(
            eventId,
            userId,
        );

        if (!participante) {
            throw new EventError(
                'NOT_SIGNED_UP',
                'Este utilizador não se inscreveu neste evento.',
            );
        }

        await this.eventRepository.setParticipantStatus({
            participantId: participante.id,
            status: EventParticipantStatus.no_show,
            /**
             * Perder a presença apaga também quem a tinha confirmado: a
             * base de dados só exige esse par enquanto o estado for
             * confirmado, e deixá-lo lá diria que alguém ainda afirma
             * uma presença que já não existe.
             */
            confirmedBy: null,
            weight: 1,
            changedBy,
        });
    }

    async listParticipants(
        owner: EventOwner,
        eventId: string,
    ): Promise<EventParticipantEntry[]> {
        await this.requireEvent(owner, eventId);

        const participantes = await this.eventRepository.listParticipants(eventId);

        return participantes.map((participante) => ({
            userId: participante.user.id,
            username: participante.user.username,
            avatarUrl: participante.user.avatarUrl,
            status: participante.status,
            weight: participante.weight,
            confirmedBy: participante.confirmed_by,
            confirmedAt: participante.confirmed_at,
            signedUpAt: participante.created_at,
        }));
    }

    /**
     * Quem participou e com que peso, para a tesouraria dividir.
     *
     * É a porta de entrada do outro módulo neste. Devolve apenas
     * presenças confirmadas: a inscrição sozinha não dá direito a nada.
     */
    async listConfirmedParticipants(
        owner: EventOwner,
        eventId: string,
    ): Promise<ConfirmedParticipant[]> {
        await this.requireEvent(owner, eventId);

        const confirmados =
            await this.eventRepository.listConfirmedParticipants(eventId);

        return confirmados.map((confirmado) => ({
            userId: confirmado.userId,
            weight: confirmado.weight,
        }));
    }

    /**
     * Recusa a inscrição quando o evento está cheio.
     */
    private async assertHasRoom(evento: EventRecord): Promise<void> {
        if (evento.capacity === null) {
            return;
        }

        const ocupados = await this.eventRepository.countOccupied(evento.id);

        if (ocupados >= evento.capacity) {
            throw new EventError('EVENT_FULL', 'Este evento já está cheio.');
        }
    }

    /**
     * Lê o evento e confirma que pertence a quem a rota diz.
     *
     * O guard de autorização avalia a permissão no âmbito lido dos
     * parâmetros. Sem esta verificação, quem organiza eventos numa crew
     * podia mexer nos de outra passando o eventId de lá.
     */
    private async requireEvent(
        owner: EventOwner,
        eventId: string,
    ): Promise<EventRecord> {
        this.assertSingleOwner(owner);

        const evento = await this.eventRepository.findById(eventId);

        if (
            !evento ||
            evento.crewId !== (owner.crewId ?? null) ||
            evento.serverId !== (owner.serverId ?? null)
        ) {
            throw new EventError('EVENT_NOT_FOUND', 'Evento não encontrado.');
        }

        return evento;
    }

    /**
     * Um evento pertence a exatamente um titular: crew ou servidor.
     *
     * A base de dados garante a mesma regra com um CHECK. Verificar aqui
     * transforma um erro de programação num erro claro, em vez de numa
     * consulta que devolve silenciosamente o evento errado.
     */
    private assertSingleOwner(owner: EventOwner): void {
        const preenchidos = [owner.crewId, owner.serverId].filter(
            (valor) => valor !== undefined && valor !== null,
        );

        if (preenchidos.length !== 1) {
            throw new EventError(
                'INVALID_EVENT_OWNER',
                'Um evento pertence a exatamente um titular: crew ou servidor.',
            );
        }
    }

    private async buildSummary(evento: EventRecord): Promise<EventSummary> {
        const contagens = await this.eventRepository.countParticipantsFor([
            evento.id,
        ]);

        const inscritos = contagens.reduce(
            (soma, contagem) => soma + contagem._count._all,
            0,
        );

        const confirmados = contagens
            .filter(
                (contagem) => contagem.status === EventParticipantStatus.confirmed,
            )
            .reduce((soma, contagem) => soma + contagem._count._all, 0);

        return this.toSummary(evento, inscritos, confirmados);
    }

    private toSummary(
        evento: EventRecord,
        signedUpCount: number,
        confirmedCount: number,
    ): EventSummary {
        return {
            id: evento.id,
            name: evento.name,
            description: evento.description,
            status: evento.status,
            startsAt: evento.starts_at,
            endsAt: evento.ends_at,
            capacity: evento.capacity,
            organizerId: evento.organizer_id,
            signedUpCount,
            confirmedCount,
            createdAt: evento.created_at,
        };
    }
}
