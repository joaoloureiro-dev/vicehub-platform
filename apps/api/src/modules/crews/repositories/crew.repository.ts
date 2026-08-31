import {
    MembershipStatus,
    MembershipType,
    SourceType,
    type DatabaseClient,
} from '@vicehub/database';

interface CreateCrewInput {
    name: string;
    tag: string;
    description?: string | null | undefined;
    founderId: string;
}

/**
 * Repositório do módulo de crews.
 */
export class CrewRepository {
    constructor(private readonly database: DatabaseClient) { }

    findById(crewId: string) {
        return this.database.crew.findFirst({
            where: { id: crewId, is_deleted: false },
        });
    }

    findByNameOrTag(name: string, tag: string) {
        return this.database.crew.findFirst({
            where: {
                is_deleted: false,
                OR: [{ name }, { tag }],
            },
            select: { name: true, tag: true },
        });
    }

    /**
     * Cria a crew já com o fundador como membro ativo.
     *
     * A adesão entra na mesma escrita aninhada que cria a crew: nunca
     * existe uma crew sem membros, nem sequer por instantes.
     */
    createWithFounder(input: CreateCrewInput) {
        const data: {
            name: string;
            tag: string;
            source: SourceType;
            created_by: string;
            description?: string | null;
            memberships: unknown;
        } = {
            name: input.name,
            tag: input.tag,
            source: SourceType.api,
            created_by: input.founderId,
            memberships: {
                create: {
                    userId: input.founderId,
                    type: MembershipType.crew,
                    status: MembershipStatus.active,
                    responded_at: new Date(),
                    responded_by: input.founderId,
                    source: SourceType.api,
                },
            },
        };

        if (input.description !== undefined) {
            data.description = input.description;
        }

        return this.database.crew.create({
            data: data as never,
        });
    }

    updateCrew(
        crewId: string,
        input: { name?: string | undefined; description?: string | null | undefined },
    ) {
        const data: {
            version: { increment: number };
            name?: string;
            description?: string | null;
        } = { version: { increment: 1 } };

        if (input.name !== undefined) {
            data.name = input.name;
        }

        if (input.description !== undefined) {
            data.description = input.description;
        }

        return this.database.crew.update({ where: { id: crewId }, data });
    }

    countActiveMembers(crewId: string) {
        return this.database.membership.count({
            where: {
                crewId,
                type: MembershipType.crew,
                status: MembershipStatus.active,
                is_deleted: false,
            },
        });
    }

    /**
     * Procura a adesão em aberto de um utilizador a uma crew.
     *
     * Estados terminais não contam: quem saiu não é membro, e a base de
     * dados permite-lhe voltar a pedir entrada.
     */
    findOpenMembership(crewId: string, userId: string) {
        return this.database.membership.findFirst({
            where: {
                crewId,
                userId,
                type: MembershipType.crew,
                is_deleted: false,
                status: {
                    in: [MembershipStatus.pending, MembershipStatus.active],
                },
            },
        });
    }

    createJoinRequest(crewId: string, userId: string) {
        return this.database.membership.create({
            data: {
                crewId,
                userId,
                type: MembershipType.crew,
                status: MembershipStatus.pending,
                source: SourceType.api,
            },
        });
    }

    setMembershipStatus(
        membershipId: string,
        status: MembershipStatus,
        respondedBy: string | null,
    ) {
        return this.database.membership.update({
            where: { id: membershipId },
            data: {
                status,
                responded_at: new Date(),
                responded_by: respondedBy,
                version: { increment: 1 },
            },
        });
    }

    listMembers(crewId: string, status: MembershipStatus) {
        return this.database.membership.findMany({
            where: {
                crewId,
                type: MembershipType.crew,
                status,
                is_deleted: false,
            },
            orderBy: { created_at: 'asc' },
            select: {
                created_at: true,
                user: {
                    select: { id: true, username: true, avatarUrl: true },
                },
            },
        });
    }

    /**
     * Cargos de crew atribuídos aos membros indicados.
     *
     * Uma única consulta para todos, em vez de uma por membro.
     */
    listScopedRoles(crewId: string, userIds: string[]) {
        return this.database.userRole.findMany({
            where: {
                crewId,
                userId: { in: userIds },
                is_deleted: false,
            },
            select: { userId: true, role: { select: { slug: true } } },
        });
    }
}
