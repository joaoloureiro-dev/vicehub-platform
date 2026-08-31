import {
    MembershipStatus,
    MembershipType,
    SourceType,
    type DatabaseClient,
} from '@vicehub/database';

interface CreateServerInput {
    name: string;
    region?: string | null | undefined;
    description?: string | null | undefined;
    ownerId: string;
}

/**
 * Repositório do módulo de servidores.
 */
export class ServerRepository {
    constructor(private readonly database: DatabaseClient) { }

    findById(serverId: string) {
        return this.database.server.findFirst({
            where: { id: serverId, is_deleted: false },
        });
    }

    findByName(name: string) {
        return this.database.server.findFirst({
            where: { name, is_deleted: false },
            select: { name: true },
        });
    }

    /**
     * Cria o servidor já com o dono como membro ativo.
     *
     * A adesão entra na mesma escrita aninhada que cria o servidor: nunca
     * existe um servidor sem membros, nem sequer por instantes.
     */
    createWithOwner(input: CreateServerInput) {
        const data: {
            name: string;
            source: SourceType;
            created_by: string;
            region?: string | null;
            description?: string | null;
            memberships: unknown;
        } = {
            name: input.name,
            source: SourceType.api,
            created_by: input.ownerId,
            memberships: {
                create: {
                    userId: input.ownerId,
                    type: MembershipType.server,
                    status: MembershipStatus.active,
                    responded_at: new Date(),
                    responded_by: input.ownerId,
                    source: SourceType.api,
                },
            },
        };

        if (input.region !== undefined) {
            data.region = input.region;
        }

        if (input.description !== undefined) {
            data.description = input.description;
        }

        return this.database.server.create({
            data: data as never,
        });
    }

    updateServer(
        serverId: string,
        input: {
            name?: string | undefined;
            region?: string | null | undefined;
            description?: string | null | undefined;
            isOnline?: boolean | undefined;
        },
    ) {
        const data: {
            version: { increment: number };
            name?: string;
            region?: string | null;
            description?: string | null;
            isOnline?: boolean;
        } = { version: { increment: 1 } };

        if (input.name !== undefined) {
            data.name = input.name;
        }

        if (input.region !== undefined) {
            data.region = input.region;
        }

        if (input.description !== undefined) {
            data.description = input.description;
        }

        if (input.isOnline !== undefined) {
            data.isOnline = input.isOnline;
        }

        return this.database.server.update({ where: { id: serverId }, data });
    }

    countActiveMembers(serverId: string) {
        return this.database.membership.count({
            where: {
                serverId,
                type: MembershipType.server,
                status: MembershipStatus.active,
                is_deleted: false,
            },
        });
    }

    /**
     * Procura a adesão em aberto de um utilizador a um servidor.
     *
     * Estados terminais não contam: quem saiu não é membro, e a base de
     * dados permite-lhe voltar a pedir entrada.
     */
    findOpenMembership(serverId: string, userId: string) {
        return this.database.membership.findFirst({
            where: {
                serverId,
                userId,
                type: MembershipType.server,
                is_deleted: false,
                status: {
                    in: [MembershipStatus.pending, MembershipStatus.active],
                },
            },
        });
    }

    createJoinRequest(serverId: string, userId: string) {
        return this.database.membership.create({
            data: {
                serverId,
                userId,
                type: MembershipType.server,
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

    listMembers(serverId: string, status: MembershipStatus) {
        return this.database.membership.findMany({
            where: {
                serverId,
                type: MembershipType.server,
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
     * Cargos de servidor atribuídos aos membros indicados.
     *
     * Uma única consulta para todos, em vez de uma por membro.
     */
    listScopedRoles(serverId: string, userIds: string[]) {
        return this.database.userRole.findMany({
            where: {
                serverId,
                userId: { in: userIds },
                is_deleted: false,
            },
            select: { userId: true, role: { select: { slug: true } } },
        });
    }
}
