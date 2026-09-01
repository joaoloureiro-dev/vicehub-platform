export type EventErrorCode =
    | 'EVENT_NOT_FOUND'
    | 'INVALID_EVENT_OWNER'
    | 'EVENT_NOT_SCHEDULED'
    | 'EVENT_ALREADY_CLOSED'
    | 'INVALID_STATUS_TRANSITION'
    | 'EVENT_FULL'
    | 'ALREADY_SIGNED_UP'
    | 'NOT_SIGNED_UP'
    | 'NOT_A_MEMBER'
    | 'ATTENDANCE_NOT_CONFIRMABLE'
    | 'STARTS_IN_THE_PAST'
    | 'ENDS_BEFORE_IT_STARTS';

export class EventError extends Error {
    constructor(
        public readonly code: EventErrorCode,
        message: string,
    ) {
        super(message);

        this.name = 'EventError';
    }
}
