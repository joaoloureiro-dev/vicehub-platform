export type CrewErrorCode =
    | 'CREW_NOT_FOUND'
    | 'CREW_NAME_TAKEN'
    | 'CREW_TAG_TAKEN'
    | 'MEMBERSHIP_NOT_FOUND'
    | 'ALREADY_MEMBER'
    | 'NOT_A_MEMBER'
    | 'MEMBERSHIP_NOT_PENDING'
    | 'CANNOT_MANAGE_SELF';

export class CrewError extends Error {
    constructor(
        public readonly code: CrewErrorCode,
        message: string,
    ) {
        super(message);

        this.name = 'CrewError';
    }
}
