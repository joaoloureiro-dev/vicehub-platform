import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventParticipantStatus, EventStatus } from '@vicehub/database';

import { EventError } from '../../src/modules/events/errors/event.errors.js';
import { EventService } from '../../src/modules/events/services/event.service.js';
import type { EventRepository } from '../../src/modules/events/repositories/event.repository.js';

const CREW = { crewId: 'crew-1' };

const eventRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'event-1',
    crewId: 'crew-1',
    serverId: null,
    name: 'Assalto ao banco',
    description: null,
    status: EventStatus.scheduled as string,
    starts_at: new Date('2026-10-01T20:00:00.000Z'),
    ends_at: null,
    capacity: null,
    organizer_id: 'user-leader',
    created_at: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides,
});

const participantRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'participant-1',
    eventId: 'event-1',
    userId: 'user-1',
    status: EventParticipantStatus.signed_up as string,
    weight: 1,
    ...overrides,
});

const createRepositoryMock = () => ({
    findById: vi.fn().mockResolvedValue(eventRow()),
    createEvent: vi.fn().mockResolvedValue(eventRow()),
    updateEvent: vi.fn().mockResolvedValue(undefined),
    transitionStatus: vi.fn().mockResolvedValue(true),
    listForOwner: vi.fn().mockResolvedValue([]),
    countParticipantsFor: vi.fn().mockResolvedValue([]),
    countOccupied: vi.fn().mockResolvedValue(0),
    findParticipant: vi.fn().mockResolvedValue(null),
    signUp: vi.fn().mockResolvedValue(undefined),
    setParticipantStatus: vi.fn().mockResolvedValue(undefined),
    listParticipants: vi.fn().mockResolvedValue([]),
    listConfirmedParticipants: vi.fn().mockResolvedValue([]),
    isActiveMember: vi.fn().mockResolvedValue(true),
});

describe('EventService', () => {
    let repository: ReturnType<typeof createRepositoryMock>;
    let service: EventService;

    beforeEach(() => {
        repository = createRepositoryMock();
        service = new EventService(repository as unknown as EventRepository);
    });

    const expectEventError = async (promise: Promise<unknown>, code: string) => {
        const error = await promise.catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(EventError);
        expect((error as EventError).code).toBe(code);
    };

    describe('a que titular pertence', () => {
        it('recusa um pedido sem crew nem servidor', async () => {
            await expectEventError(
                service.listEvents({}, { limit: 25 }),
                'INVALID_EVENT_OWNER',
            );
        });

        it('recusa um pedido com crew e servidor ao mesmo tempo', async () => {
            await expectEventError(
                service.listEvents(
                    { crewId: 'crew-1', serverId: 'server-1' },
                    { limit: 25 },
                ),
                'INVALID_EVENT_OWNER',
            );
        });

        /**
         * O guard avalia a permissão no âmbito lido dos parâmetros. Sem
         * esta verificação, quem organiza eventos numa crew mexia nos de
         * outra bastando-lhe passar o eventId de lá.
         */
        it('não encontra um evento que é de outra crew', async () => {
            repository.findById.mockResolvedValue(eventRow({ crewId: 'crew-2' }));

            await expectEventError(
                service.getEvent(CREW, 'event-1'),
                'EVENT_NOT_FOUND',
            );
        });

        it('não encontra um evento de servidor a partir da crew', async () => {
            repository.findById.mockResolvedValue(
                eventRow({ crewId: null, serverId: 'server-1' }),
            );

            await expectEventError(
                service.getEvent(CREW, 'event-1'),
                'EVENT_NOT_FOUND',
            );
        });
    });

    describe('inscrição', () => {
        /**
         * Sem isto, qualquer conta se inscrevia nos eventos de uma crew
         * a que não pertence e, uma vez confirmada, recebia parte dos
         * ganhos dela.
         */
        it('recusa quem não pertence à crew', async () => {
            repository.isActiveMember.mockResolvedValue(false);

            await expectEventError(
                service.signUp(CREW, 'event-1', 'estranho'),
                'NOT_A_MEMBER',
            );

            expect(repository.signUp).not.toHaveBeenCalled();
        });

        it('recusa inscrição num evento que já não está agendado', async () => {
            repository.findById.mockResolvedValue(
                eventRow({ status: EventStatus.ongoing }),
            );

            await expectEventError(
                service.signUp(CREW, 'event-1', 'user-1'),
                'EVENT_NOT_SCHEDULED',
            );
        });

        it('recusa quem já está inscrito', async () => {
            repository.findParticipant.mockResolvedValue(participantRow());

            await expectEventError(
                service.signUp(CREW, 'event-1', 'user-1'),
                'ALREADY_SIGNED_UP',
            );
        });

        /**
         * Quem desistiu pode voltar: a linha é reaproveitada, e o
         * histórico não se multiplica.
         */
        it('deixa voltar quem tinha desistido', async () => {
            repository.findParticipant.mockResolvedValue(
                participantRow({ status: EventParticipantStatus.withdrawn }),
            );

            await service.signUp(CREW, 'event-1', 'user-1');

            expect(repository.signUp).toHaveBeenCalledWith('event-1', 'user-1');
        });

        it('recusa quando o evento está cheio', async () => {
            repository.findById.mockResolvedValue(eventRow({ capacity: 4 }));
            repository.countOccupied.mockResolvedValue(4);

            await expectEventError(
                service.signUp(CREW, 'event-1', 'user-1'),
                'EVENT_FULL',
            );
        });

        it('aceita quando ainda há lugar', async () => {
            repository.findById.mockResolvedValue(eventRow({ capacity: 4 }));
            repository.countOccupied.mockResolvedValue(3);

            await service.signUp(CREW, 'event-1', 'user-1');

            expect(repository.signUp).toHaveBeenCalled();
        });

        /**
         * Sem lotação não há que contar: perguntar seria uma consulta
         * por inscrição sem nada que a justifique.
         */
        it('não conta lugares num evento sem lotação', async () => {
            await service.signUp(CREW, 'event-1', 'user-1');

            expect(repository.countOccupied).not.toHaveBeenCalled();
        });
    });

    describe('desistência', () => {
        it('recusa quem não tem inscrição em aberto', async () => {
            await expectEventError(
                service.withdraw(CREW, 'event-1', 'user-1'),
                'NOT_SIGNED_UP',
            );
        });

        /**
         * A confirmação é uma afirmação de quem organiza sobre o que
         * aconteceu. Deixar quem participou apagá-la reescreveria o
         * registo que dá direito a receber.
         */
        it('não deixa desistir quem já tem presença confirmada', async () => {
            repository.findParticipant.mockResolvedValue(
                participantRow({ status: EventParticipantStatus.confirmed }),
            );

            await expectEventError(
                service.withdraw(CREW, 'event-1', 'user-1'),
                'NOT_SIGNED_UP',
            );

            expect(repository.setParticipantStatus).not.toHaveBeenCalled();
        });

        it('retira uma inscrição em aberto', async () => {
            repository.findParticipant.mockResolvedValue(participantRow());

            await service.withdraw(CREW, 'event-1', 'user-1');

            expect(repository.setParticipantStatus).toHaveBeenCalledWith({
                participantId: 'participant-1',
                status: EventParticipantStatus.withdrawn,
                changedBy: 'user-1',
            });
        });
    });

    describe('presenças', () => {
        it('recusa confirmar quem nunca se inscreveu', async () => {
            await expectEventError(
                service.confirmAttendance(CREW, 'event-1', 'user-1', 1, 'lider'),
                'NOT_SIGNED_UP',
            );
        });

        /**
         * Um evento cancelado não aconteceu, e confirmar presenças nele
         * abriria a porta a pagar por uma coisa que não houve.
         */
        it('recusa confirmar presenças num evento cancelado', async () => {
            repository.findById.mockResolvedValue(
                eventRow({ status: EventStatus.canceled }),
            );
            repository.findParticipant.mockResolvedValue(participantRow());

            await expectEventError(
                service.confirmAttendance(CREW, 'event-1', 'user-1', 1, 'lider'),
                'ATTENDANCE_NOT_CONFIRMABLE',
            );

            expect(repository.setParticipantStatus).not.toHaveBeenCalled();
        });

        it('grava quem confirmou, com o peso atribuído', async () => {
            repository.findParticipant.mockResolvedValue(participantRow());

            await service.confirmAttendance(CREW, 'event-1', 'user-1', 3, 'lider');

            expect(repository.setParticipantStatus).toHaveBeenCalledWith({
                participantId: 'participant-1',
                status: EventParticipantStatus.confirmed,
                weight: 3,
                confirmedBy: 'lider',
                changedBy: 'lider',
            });
        });

        /**
         * Perder a presença apaga também quem a tinha confirmado: deixá-lo
         * lá diria que alguém ainda afirma uma presença que já não existe.
         */
        it('marcar como ausente apaga a confirmação anterior', async () => {
            repository.findParticipant.mockResolvedValue(
                participantRow({ status: EventParticipantStatus.confirmed, weight: 5 }),
            );

            await service.markNoShow(CREW, 'event-1', 'user-1', 'lider');

            expect(repository.setParticipantStatus).toHaveBeenCalledWith({
                participantId: 'participant-1',
                status: EventParticipantStatus.no_show,
                confirmedBy: null,
                weight: 1,
                changedBy: 'lider',
            });
        });

        it('devolve à tesouraria apenas quem tem presença confirmada', async () => {
            repository.listConfirmedParticipants.mockResolvedValue([
                { userId: 'user-1', weight: 3 },
                { userId: 'user-2', weight: 1 },
            ]);

            await expect(
                service.listConfirmedParticipants(CREW, 'event-1'),
            ).resolves.toEqual([
                { userId: 'user-1', weight: 3 },
                { userId: 'user-2', weight: 1 },
            ]);
        });
    });

    describe('mudanças de estado', () => {
        it.each([
            ['ongoing', [EventStatus.scheduled]],
            ['completed', [EventStatus.scheduled, EventStatus.ongoing]],
            ['canceled', [EventStatus.scheduled, EventStatus.ongoing]],
        ] as const)('%s só parte dos estados previstos', async (destino, origens) => {
            await service.transition(CREW, 'event-1', destino, 'lider');

            expect(repository.transitionStatus).toHaveBeenCalledWith(
                'event-1',
                origens,
                destino,
                'lider',
            );
        });

        /**
         * A transição é condicional na base de dados. Quando não encontra
         * linha, é porque o evento já mudou de estado entretanto — e
         * insistir reabriria decisões já tomadas.
         */
        it('recusa quando o evento já mudou de estado entretanto', async () => {
            repository.transitionStatus.mockResolvedValue(false);

            await expectEventError(
                service.transition(CREW, 'event-1', 'completed', 'lider'),
                'INVALID_STATUS_TRANSITION',
            );
        });
    });

    describe('alteração', () => {
        it.each([EventStatus.completed, EventStatus.canceled])(
            'recusa alterar um evento %s',
            async (status) => {
                repository.findById.mockResolvedValue(eventRow({ status }));

                await expectEventError(
                    service.updateEvent(CREW, 'event-1', { name: 'Outro' }, 'lider'),
                    'EVENT_ALREADY_CLOSED',
                );
            },
        );

        /**
         * O fim é verificado contra o início que fica, e não apenas
         * contra o que veio no pedido: alterar só o início podia
         * deixá-lo depois de um fim que já lá estava.
         */
        it('recusa um início posterior ao fim já gravado', async () => {
            repository.findById.mockResolvedValue(
                eventRow({ ends_at: new Date('2026-10-01T22:00:00.000Z') }),
            );

            await expectEventError(
                service.updateEvent(
                    CREW,
                    'event-1',
                    { startsAt: new Date('2026-10-02T10:00:00.000Z') },
                    'lider',
                ),
                'ENDS_BEFORE_IT_STARTS',
            );

            expect(repository.updateEvent).not.toHaveBeenCalled();
        });

        it('aceita alterar só o início quando não há fim marcado', async () => {
            await service.updateEvent(
                CREW,
                'event-1',
                { startsAt: new Date('2026-10-02T10:00:00.000Z') },
                'lider',
            );

            expect(repository.updateEvent).toHaveBeenCalled();
        });
    });

    describe('listagem', () => {
        /**
         * Por omissão a lista mostra o que está para vir, que é o que
         * interessa a quem quer participar.
         */
        it('esconde o passado a não ser que o peçam', async () => {
            await service.listEvents(CREW, { limit: 25 });

            expect(repository.listForOwner).toHaveBeenCalledWith(
                expect.objectContaining({ notBefore: expect.any(Date) }),
            );
        });

        it('mostra o histórico quando o pedem', async () => {
            await service.listEvents(CREW, { limit: 25, includePast: true });

            expect(repository.listForOwner).toHaveBeenCalledWith(
                expect.objectContaining({ notBefore: undefined }),
            );
        });

        it('não pergunta por contagens quando não há eventos', async () => {
            await service.listEvents(CREW, { limit: 25 });

            expect(repository.countParticipantsFor).not.toHaveBeenCalled();
        });

        /**
         * As contagens da lista inteira são lidas de uma vez: uma
         * consulta por evento faria o custo crescer com a lista.
         */
        it('separa inscritos de confirmados numa consulta só', async () => {
            repository.listForOwner.mockResolvedValue([
                eventRow(),
                eventRow({ id: 'event-2' }),
            ]);
            repository.countParticipantsFor.mockResolvedValue([
                {
                    eventId: 'event-1',
                    status: EventParticipantStatus.signed_up,
                    _count: { _all: 2 },
                },
                {
                    eventId: 'event-1',
                    status: EventParticipantStatus.confirmed,
                    _count: { _all: 3 },
                },
            ]);

            const eventos = await service.listEvents(CREW, { limit: 25 });

            expect(repository.countParticipantsFor).toHaveBeenCalledTimes(1);
            expect(eventos[0]?.signedUpCount).toBe(5);
            expect(eventos[0]?.confirmedCount).toBe(3);
            expect(eventos[1]?.signedUpCount).toBe(0);
            expect(eventos[1]?.confirmedCount).toBe(0);
        });
    });
});
