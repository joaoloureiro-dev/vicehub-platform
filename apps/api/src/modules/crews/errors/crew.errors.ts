export type CrewErrorCode =
    | 'CREW_NOT_FOUND'
    | 'CREW_NAME_TAKEN'
    | 'CREW_TAG_TAKEN'
    | 'MEMBERSHIP_NOT_FOUND'
    | 'ALREADY_MEMBER'
    | 'NOT_A_MEMBER'
    | 'MEMBERSHIP_NOT_PENDING'
    | 'CANNOT_MANAGE_SELF'
    | 'CREW_HAS_FUNDS'
    | 'CREW_HAS_OPEN_DECISIONS'
    | 'CREW_HAS_ACTIVE_PLAN';

export class CrewError extends Error {
    constructor(
        public readonly code: CrewErrorCode,
        message: string,
    ) {
        super(message);

        this.name = 'CrewError';
    }
}
