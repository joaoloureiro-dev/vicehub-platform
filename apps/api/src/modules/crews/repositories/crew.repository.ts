import {
    ENTITLING_SUBSCRIPTION_STATUSES,
    MembershipStatus,
    MembershipType,
    SourceType,
    type DatabaseClient,
} from '@vicehub/database';

import type { UpdateAppearanceDto } from '../../../shared/appearance.js';
import { toAppearanceColumns } from '../../../shared/appearance.js';

interface CreateCrewInput {
    name: string;
    tag: string;
    description?: string | null | undefined;
    founderId: string;
}

/**
 * Campos que uma linha do diretório mostra.
 *
 * Partilhado entre a listagem e o destaque para que as duas devolvam
 * exatamente a mesma forma: uma entrada em destaque é a mesma crew no
 * mesmo formato, apenas noutro sítio da página.
 */
const DIRECTORY_ENTRY_SELECT = {
    id: true,
    name: true,
    tag: true,
    description: true,
    banner_url: true,
    accent_color: true,
    level: true,
    created_at: true,
} as const;

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
            wallet: unknown;
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
            wallet: {
                create: {
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

    /**
     * Grava a personalização da crew.
     *
     * Separada de updateCrew porque a rota que lhe chega exige plano
     * ativo, e juntá-las faria alterar a descrição passar a ser pago.
     */
    updateAppearance(crewId: string, input: UpdateAppearanceDto) {
        return this.database.crew.update({
            where: { id: crewId },
            data: {
                ...toAppearanceColumns(input),
                version: { increment: 1 },
            },
        });
    }

    /**
     * Crews com plano ativo, candidatas aos lugares de destaque.
     *
     * Devolve só os identificadores e por ordem estável: a rotação que
     * decide quem ocupa os lugares precisa da lista inteira, mas não do
     * conteúdo de cada linha, e as assinantes são poucas ao pé do
     * diretório todo. Se um dia deixarem de ser, é aqui que se põe um
     * tecto.
     */
    listEntitledIds() {
        return this.database.crew.findMany({
            where: {
                is_deleted: false,
                subscriptions: {
                    some: {
                        is_deleted: false,
                        status: { in: [...ENTITLING_SUBSCRIPTION_STATUSES] },
                        current_period_end: { gt: new Date() },
                    },
                },
            },
            orderBy: { id: 'asc' },
            select: { id: true },
        });
    }

    /**
     * As linhas do diretório correspondentes aos identificadores dados.
     *
     * A ordem devolvida pela base de dados não é a ordem pedida; quem
     * chama é que a repõe, porque é quem sabe qual foi.
     */
    listDirectoryEntriesByIds(crewIds: string[]) {
        return this.database.crew.findMany({
            where: { id: { in: crewIds }, is_deleted: false },
            select: DIRECTORY_ENTRY_SELECT,
        });
    }

    /**
     * Uma página do diretório público de crews.
     *
     * A contagem vem na mesma transação que a página: sem isso, uma crew
     * criada entre as duas consultas daria um total que não bate certo
     * com o que foi devolvido.
     */
    listDirectory(input: {
        search?: string | undefined;
        skip: number;
        take: number;
        sort: 'newest' | 'level' | 'name';
    }) {
        const where = {
            is_deleted: false,
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
                            tag: {
                                contains: input.search,
                                mode: 'insensitive' as const,
                            },
                        },
                    ],
                }
                : {}),
        };

        const orderBy =
            input.sort === 'level'
                ? [{ level: 'desc' as const }, { xp: 'desc' as const }]
                : input.sort === 'name'
                    ? [{ name: 'asc' as const }]
                    : [{ created_at: 'desc' as const }];

        return this.database.$transaction([
            this.database.crew.findMany({
                where,
                /**
                 * O id desempata: sem uma ordem total, duas crews com o
                 * mesmo nível podiam trocar de página entre pedidos e
                 * aparecer duas vezes ou nenhuma.
                 */
                orderBy: [...orderBy, { id: 'asc' as const }],
                skip: input.skip,
                take: input.take,
                select: DIRECTORY_ENTRY_SELECT,
            }),
            this.database.crew.count({ where }),
        ]);
    }

    /**
     * Conta os membros ativos de várias crews de uma só vez.
     *
     * Uma consulta para a página inteira, em vez de uma por linha.
     */
    countActiveMembersFor(crewIds: string[]) {
        return this.database.membership.groupBy({
            by: ['crewId'],
            where: {
                crewId: { in: crewIds },
                type: MembershipType.crew,
                status: MembershipStatus.active,
                is_deleted: false,
            },
            _count: { _all: true },
        });
    }

    /**
     * Crews a que um utilizador pertence ou a que se candidatou.
     *
     * Só os estados em aberto: quem saiu ou foi recusado pode voltar a
     * candidatar-se, e listar esses casos daria a ideia errada de que
     * ainda há alguma coisa pendente.
     */
    listOpenMembershipsOfUser(userId: string) {
        return this.database.membership.findMany({
            where: {
                userId,
                type: MembershipType.crew,
                is_deleted: false,
                status: {
                    in: [MembershipStatus.pending, MembershipStatus.active],
                },
            },
            orderBy: { created_at: 'desc' },
            select: {
                crewId: true,
                status: true,
                created_at: true,
                crew: { select: { id: true, name: true, tag: true } },
            },
        });
    }

    /**
     * Cargos de crew de um utilizador nas crews indicadas.
     */
    listUserScopedRoles(userId: string, crewIds: string[]) {
        return this.database.userRole.findMany({
            where: {
                userId,
                crewId: { in: crewIds },
                is_deleted: false,
            },
            select: { crewId: true, role: { select: { slug: true } } },
        });
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
