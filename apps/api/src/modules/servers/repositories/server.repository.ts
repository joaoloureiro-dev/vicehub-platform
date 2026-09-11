import {
    entitlingSubscriptionFilter,
    fimDaAvaliacao,
    PLANS,
    SubscriptionPlan,
    SubscriptionStatus,
    filtroDeOnline,
    MembershipStatus,
    MembershipType,
    SourceType,
    type DatabaseClient,
} from '@vicehub/database';

import type { UpdateAppearanceDto } from '../../../shared/appearance.js';
import { toAppearanceColumns } from '../../../shared/appearance.js';
import type { DeletionBlockers } from '../../../shared/community-deletion.js';
import {
    findDeletionBlockers,
    softDeleteCommunity,
} from '../../../shared/community-deletion.js';

interface CreateServerInput {
    name: string;
    region?: string | null | undefined;
    description?: string | null | undefined;
    ownerId: string;
}

/**
 * Campos que uma linha do diretório mostra.
 *
 * Partilhado entre a listagem e o destaque para que as duas devolvam
 * exatamente a mesma forma.
 */
const DIRECTORY_ENTRY_SELECT = {
    id: true,
    name: true,
    region: true,
    description: true,
    banner_url: true,
    accent_color: true,
    isOnline: true,
    last_heartbeat_at: true,
    players_online: true,
    created_at: true,
} as const;

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

    /**
     * O servidor que já ocupa este nome, se houver.
     *
     * `excluirServerId` serve as alterações: aí a pergunta não é "alguém
     * tem este nome?" — é "alguém *além deste servidor* tem este
     * nome?". Sem isso, guardar um formulário sem tocar no nome era
     * recusado pelo próprio servidor, porque um formulário envia sempre
     * todos os campos.
     */
    findByName(name: string, excluirServerId?: string) {
        return this.database.server.findFirst({
            where: {
                name,
                is_deleted: false,
                ...(excluirServerId === undefined
                    ? {}
                    : { id: { not: excluirServerId } }),
            },
            select: { name: true },
        });
    }

    /**
     * Cria o servidor já com o dono como membro ativo.
     *
     * A adesão entra na mesma escrita aninhada que cria o servidor: nunca
     * existe um servidor sem membros, nem sequer por instantes.
     *
     * A avaliação entra pela mesma razão: um servidor que nascesse sem
     * ela abria com a tesouraria fechada e com lugar para três crews em
     * vez de dez, e quem o criou não teria como saber que lhe faltava
     * alguma coisa. Ou nasce inteiro, ou não nasce.
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
            subscriptions: unknown;
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
            /**
             * O escalão de entrada, e não o plano de uma pessoa: o que
             * um servidor compra é o direito a ter crews a jogar lá, e
             * uma avaliação que não mostrasse esse direito não mostrava
             * nada. Durante trinta dias vale por dez crews; depois, se
             * ninguém pagar, valem três — e as que entretanto entraram
             * ficam, porque nunca se tira uma crew a ninguém.
             */
            subscriptions: {
                create: {
                    plan: SubscriptionPlan.server_base,
                    status: SubscriptionStatus.trialing,
                    /** Zero: uma avaliação não cobra nada a ninguém. */
                    price_cents: 0,
                    currency: PLANS.server_base.currency,
                    current_period_start: new Date(),
                    current_period_end: fimDaAvaliacao(),
                    source: SourceType.api,
                    created_by: input.ownerId,
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
            joinRequirements?: string | null | undefined;
            isOnline?: boolean | undefined;
        },
    ) {
        const data: {
            version: { increment: number };
            name?: string;
            region?: string | null;
            description?: string | null;
            join_requirements?: string | null;
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

        if (input.joinRequirements !== undefined) {
            data.join_requirements = input.joinRequirements;
        }

        if (input.isOnline !== undefined) {
            data.isOnline = input.isOnline;
        }

        return this.database.server.update({ where: { id: serverId }, data });
    }

    /**
     * Grava a personalização do servidor.
     *
     * Separada de updateServer porque a rota que lhe chega exige plano
     * ativo, e juntá-las faria marcar o servidor como online passar a
     * ser pago.
     */
    updateAppearance(serverId: string, input: UpdateAppearanceDto) {
        return this.database.server.update({
            where: { id: serverId },
            data: {
                ...toAppearanceColumns(input),
                version: { increment: 1 },
            },
        });
    }

    /**
     * Servidores com plano ativo, candidatos aos lugares de destaque.
     *
     * Devolve só os identificadores e por ordem estável, como nas crews:
     * a rotação precisa da lista inteira, mas não do conteúdo das linhas.
     */
    listEntitledIds() {
        return this.database.server.findMany({
            where: {
                is_deleted: false,
                subscriptions: {
                    some: entitlingSubscriptionFilter(),
                },
            },
            orderBy: { id: 'asc' },
            select: { id: true },
        });
    }

    /**
     * As linhas do diretório correspondentes aos identificadores dados.
     */
    listDirectoryEntriesByIds(serverIds: string[]) {
        return this.database.server.findMany({
            where: { id: { in: serverIds }, is_deleted: false },
            select: DIRECTORY_ENTRY_SELECT,
        });
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
        /**
         * As duas condições vão dentro de um `AND`, e não lado a lado no
         * mesmo objeto.
         *
         * Ambas se escrevem com um `OR` — estar online é "reportou há
         * pouco **ou** nunca reportou e está marcado", e a procura é
         * "nome **ou** região". Postas lado a lado, a segunda apagava a
         * primeira: uma procura com "só online" devolvia servidores em
         * baixo, e em silêncio. Foi um teste de integração que o
         * apanhou.
         */
        const where = {
            is_deleted: false,
            AND: [
                ...(input.onlineOnly ? [filtroDeOnline()] : []),
                ...(input.search
                    ? [
                        {
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
                        },
                    ]
                    : []),
            ],
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
                select: DIRECTORY_ENTRY_SELECT,
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
    listOpenMembershipsOfUser(userId: string, recusadasDesde: Date) {
        return this.database.membership.findMany({
            where: {
                userId,
                type: MembershipType.server,
                is_deleted: false,
                OR: [
                    {
                        status: {
                            in: [MembershipStatus.pending, MembershipStatus.active],
                        },
                    },
                    /**
                     * As recusadas recentes vêm também, pela mesma razão
                     * que vêm nas crews: sem isto, uma candidatura
                     * recusada desaparecia da lista de quem a fez, e a
                     * pessoa nunca chegava a saber que tinha havido
                     * resposta.
                     */
                    {
                        status: MembershipStatus.rejected,
                        responded_at: { gte: recusadasDesde },
                    },
                ],
            },
            orderBy: { created_at: 'desc' },
            select: {
                serverId: true,
                status: true,
                created_at: true,
                responded_at: true,
                decision_note: true,
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

    createJoinRequest(
        serverId: string,
        userId: string,
        message?: string | undefined,
    ) {
        return this.database.membership.create({
            data: {
                serverId,
                userId,
                type: MembershipType.server,
                status: MembershipStatus.pending,
                source: SourceType.api,
                /**
                 * Ausente continua ausente: "não escreveu nada" e
                 * "escreveu e apagou" não são a mesma coisa para quem
                 * lê a candidatura.
                 */
                ...(message === undefined ? {} : { message }),
            },
        });
    }

    setMembershipStatus(
        membershipId: string,
        status: MembershipStatus,
        respondedBy: string | null,
        note?: string | undefined,
    ) {
        return this.database.membership.update({
            where: { id: membershipId },
            data: {
                status,
                responded_at: new Date(),
                responded_by: respondedBy,
                version: { increment: 1 },
                /** Ausente continua ausente, como nas crews. */
                ...(note === undefined ? {} : { decision_note: note }),
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
                message: true,
                user: {
                    select: { id: true, username: true, avatarUrl: true },
                },
            },
        });
    }

    /**
     * O que impede este servidor de ser apagado, se alguma coisa
     * impedir. A regra é a mesma das crews e vive num sítio só.
     */
    findDeletionBlockers(serverId: string): Promise<DeletionBlockers> {
        return findDeletionBlockers(this.database, { serverId });
    }

    /**
     * Apaga o servidor e, com ele, adesões, cargos, filiações, eventos,
     * carteira e chaves de ingestão.
     */
    softDelete(serverId: string, actorId: string): Promise<void> {
        return softDeleteCommunity(this.database, { serverId }, actorId);
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
