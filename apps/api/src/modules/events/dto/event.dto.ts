import { z } from 'zod';

import {
    confirmAttendanceSchema,
    createEventSchema,
    eventTransitionSchema,
    listEventsQuerySchema,
    listPublicEventsQuerySchema,
    updateEventSchema,
} from '../schemas/event.schemas.js';

export type CreateEventDto = z.infer<typeof createEventSchema>;
export type UpdateEventDto = z.infer<typeof updateEventSchema>;
export type ListEventsQueryDto = z.infer<typeof listEventsQuerySchema>;
export type ListPublicEventsQueryDto = z.infer<
    typeof listPublicEventsQuerySchema
>;
export type {
    EventIdParams as EventIdParamDto,
    EventParticipantParams as EventParticipantParamDto,
} from '../schemas/event.schemas.js';
export type ConfirmAttendanceDto = z.infer<typeof confirmAttendanceSchema>;
export type EventTransitionDto = z.infer<typeof eventTransitionSchema>;
