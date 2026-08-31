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
            wallet: unknown;
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
            wallet: {
                create: {
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

    /**
     * Uma página do diretório público de servidores.
     *
     * A contagem vem na mesma transação que a página: sem isso, um
     * servidor criado entre as duas consultas daria um total que não bate
     * certo com o que foi devolvido.
     */
    listDirectory(input: {
        search?: string | undefined;
        onlineOnly?: boolean | undefined;
        skip: number;
        take: number;
        sort: 'newest' | 'name';
    }) {
        const where = {
            is_deleted: false,
            ...(input.onlineOnly ? { isOnline: true } : {}),
            ...(input.search
                ? {
                    OR: [
                        {
                            name: {
                                contains: input.search,
                                mode: 'insensitive' as const,
                            },
                        },
                        {
                            region: {
                                contains: input.search,
                                mode: 'insensitive' as const,
                            },
                        },
                    ],
                }
                : {}),
        };

        const orderBy =
            input.sort === 'name'
                ? [{ name: 'asc' as const }]
                : [{ created_at: 'desc' as const }];

        return this.database.$transaction([
            this.database.server.findMany({
                where,
                /**
                 * O id desempata: sem uma ordem total, dois servidores
                 * criados no mesmo instante podiam trocar de página entre
                 * pedidos e aparecer duas vezes ou nenhuma.
                 */
                orderBy: [...orderBy, { id: 'asc' as const }],
                skip: input.skip,
                take: input.take,
                select: {
                    id: true,
                    name: true,
                    region: true,
                    description: true,
                    isOnline: true,
                    created_at: true,
                },
            }),
            this.database.server.count({ where }),
        ]);
    }

    /**
     * Conta os membros ativos de vários servidores de uma só vez.
     */
    countActiveMembersFor(serverIds: string[]) {
        return this.database.membership.groupBy({
            by: ['serverId'],
            where: {
                serverId: { in: serverIds },
                type: MembershipType.server,
                status: MembershipStatus.active,
                is_deleted: false,
            },
            _count: { _all: true },
        });
    }

    /**
     * Servidores a que um utilizador pertence ou a que se candidatou.
     *
     * Só os estados em aberto: quem saiu ou foi recusado pode voltar a
     * candidatar-se, e listar esses casos daria a ideia errada de que
     * ainda há alguma coisa pendente.
     */
    listOpenMembershipsOfUser(userId: string) {
        return this.database.membership.findMany({
            where: {
                userId,
                type: MembershipType.server,
                is_deleted: false,
                status: {
                    in: [MembershipStatus.pending, MembershipStatus.active],
                },
            },
            orderBy: { created_at: 'desc' },
            select: {
                serverId: true,
                status: true,
                created_at: true,
                server: { select: { id: true, name: true, region: true } },
            },
        });
    }

    /**
     * Cargos de servidor de um utilizador nos servidores indicados.
     */
    listUserScopedRoles(userId: string, serverIds: string[]) {
        return this.database.userRole.findMany({
            where: {
                userId,
                serverId: { in: serverIds },
                is_deleted: false,
            },
            select: { serverId: true, role: { select: { slug: true } } },
        });
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
