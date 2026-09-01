import { MembershipStatus, type RoleKey } from '@vicehub/database';

import type { UpdateAppearanceDto } from '../../../shared/appearance.js';
import { visibleAppearance } from '../../../shared/appearance.js';
import { pickFeatured } from '../../../shared/featured.js';
import type { RoleAssignmentService } from '../../authorization/services/role-assignment.service.js';
import type { SubscriptionService } from '../../subscriptions/services/subscription.service.js';
import { ServerError } from '../errors/server.errors.js';
import type { ServerRepository } from '../repositories/server.repository.js';
import type { DirectoryPage } from '../../crews/types/crew.types.js';
import type {
    ServerDirectoryEntry,
    ServerJoinRequest,
    ServerMember,
    ServerMembershipSummary,
    ServerProfile,
    ServerRecord,
} from '../types/server.types.js';

interface CreateServerInput {
    name: string;
    region?: string | null | undefined;
    description?: string | null | undefined;
    ownerId: string;
}

interface ListServersInput {
    search?: string | undefined;
    onlineOnly?: boolean | undefined;
    page: number;
    pageSize: number;
    sort: 'newest' | 'name';
}

interface UpdateServerInput {
    name?: string | undefined;
    region?: string | null | undefined;
    description?: string | null | undefined;
    isOnline?: boolean | undefined;
}

/**
 * Serviço de servidores.
 *
 * Segue o mesmo desenho do serviço de crews: o Membership diz quem
 * pertence, o RBAC diz quem manda, e é aqui que os dois se mantêm
 * coerentes — ser aceite dá cargo, sair ou ser removido retira-o.
 */
export class ServerService {
    constructor(
        private readonly serverRepository: ServerRepository,
        private readonly roleAssignmentService: RoleAssignmentService,
        private readonly subscriptionService: SubscriptionService,
    ) { }

    /**
     * Cria um servidor e faz de quem o criou o seu dono.
     */
    async createServer(input: CreateServerInput): Promise<ServerProfile> {
        const existente = await this.serverRepository.findByName(input.name);

        if (existente) {
            throw new ServerError(
                'SERVER_NAME_TAKEN',
                'Já existe um servidor com este nome.',
            );
        }

        const server = await this.serverRepository.createWithOwner(input);

        await this.roleAssignmentService.setScopedRole(input.ownerId, 'server_owner', {
            serverId: server.id,
        });

        return this.buildProfile(server);
    }

    async getProfile(serverId: string): Promise<ServerProfile> {
        return this.buildProfile(await this.requireServer(serverId));
    }

    async updateServer(
        serverId: string,
        input: UpdateServerInput,
    ): Promise<ServerProfile> {
        await this.requireServer(serverId);

        if (input.name !== undefined) {
            const existente = await this.serverRepository.findByName(input.name);

            if (existente) {
                throw new ServerError(
                    'SERVER_NAME_TAKEN',
                    'Já existe um servidor com este nome.',
                );
            }
        }

        await this.serverRepository.updateServer(serverId, input);

        return this.getProfile(serverId);
    }

    /**
     * Altera a personalização do servidor.
     *
     * Duas condições distintas, verificadas na rota: mandar no servidor
     * e o servidor ter plano ativo. O dono de um servidor sem plano
     * continua a mandar nele.
     */
    async updateAppearance(
        serverId: string,
        input: UpdateAppearanceDto,
    ): Promise<ServerProfile> {
        await this.requireServer(serverId);

        await this.serverRepository.updateAppearance(serverId, input);

        return this.getProfile(serverId);
    }

    /**
     * Pede entrada num servidor.
     *
     * O pedido fica pendente até alguém com autorização responder.
     */
    async requestToJoin(serverId: string, userId: string): Promise<void> {
        await this.requireServer(serverId);

        const aberta = await this.serverRepository.findOpenMembership(
            serverId,
            userId,
        );

        if (aberta) {
            throw new ServerError(
                'ALREADY_MEMBER',
                aberta.status === MembershipStatus.active
                    ? 'Já pertences a este servidor.'
                    : 'Já tens um pedido pendente neste servidor.',
            );
        }

        await this.serverRepository.createJoinRequest(serverId, userId);
    }

    /**
     * Retira um pedido de entrada ainda por responder.
     *
     * Sem isto, quem se candidata fica preso: a rota de saída exige uma
     * adesão ativa, e um pedido pendente bloqueia qualquer novo pedido.
     */
    async withdrawJoinRequest(serverId: string, userId: string): Promise<void> {
        const adesao = await this.requirePendingMembership(serverId, userId);

        await this.serverRepository.setMembershipStatus(
            adesao.id,
            MembershipStatus.left,
            userId,
        );
    }

    /**
     * Uma página do diretório público de servidores.
     *
     * É o que torna a candidatura possível a partir do ViceHub: sem
     * forma de encontrar um servidor, pedir entrada exigiria já saber o
     * identificador de um.
     */
    async listDirectory(
        input: ListServersInput,
    ): Promise<DirectoryPage<ServerDirectoryEntry>> {
        /**
         * O destaque não depende da página listada, por isso é pedido ao
         * mesmo tempo e não a seguir.
         */
        const [[servers, total], featured] = await Promise.all([
            this.serverRepository.listDirectory({
                search: input.search,
                onlineOnly: input.onlineOnly,
                skip: (input.page - 1) * input.pageSize,
                take: input.pageSize,
                sort: input.sort,
            }),
            this.listFeatured(input),
        ]);

        const ids = servers.map((server) => server.id);

        const [contagens, premium] = await Promise.all([
            this.serverRepository.countActiveMembersFor(ids),
            this.subscriptionService.getEntitledIds('server', ids),
        ]);

        const porServidor = new Map(
            contagens.map((contagem) => [contagem.serverId, contagem._count._all]),
        );

        return {
            items: servers.map((server) =>
                this.toDirectoryEntry(
                    server,
                    premium.has(server.id),
                    porServidor.get(server.id) ?? 0,
                ),
            ),
            featured,
            page: input.page,
            pageSize: input.pageSize,
            total,
            totalPages: Math.ceil(total / input.pageSize),
        };
    }

    /**
     * Os servidores que ocupam os lugares de destaque.
     *
     * Só na primeira página e só sem filtros: quem pesquisa ou pede
     * apenas os que estão online fez um pedido concreto, e responder-lhe
     * com colocação paga tornaria o filtro inútil.
     */
    private async listFeatured(
        input: ListServersInput,
    ): Promise<ServerDirectoryEntry[]> {
        if (
            input.page !== 1 ||
            input.search !== undefined ||
            input.onlineOnly === true
        ) {
            return [];
        }

        const candidatos = await this.serverRepository.listEntitledIds();

        const escolhidos = pickFeatured(
            candidatos.map((candidato) => candidato.id),
            new Date(),
        );

        if (escolhidos.length === 0) {
            return [];
        }

        const [servers, contagens] = await Promise.all([
            this.serverRepository.listDirectoryEntriesByIds(escolhidos),
            this.serverRepository.countActiveMembersFor(escolhidos),
        ]);

        const porId = new Map(servers.map((server) => [server.id, server]));

        const porServidor = new Map(
            contagens.map((contagem) => [contagem.serverId, contagem._count._all]),
        );

        /**
         * A ordem da rotação é reposta aqui: é ela que atribui os
         * lugares, e a base de dados devolve as linhas pela ordem que
         * lhe convier.
         */
        return escolhidos.flatMap((id) => {
            const server = porId.get(id);

            if (!server) {
                return [];
            }

            return [this.toDirectoryEntry(server, true, porServidor.get(id) ?? 0)];
        });
    }

    private toDirectoryEntry(
        server: {
            id: string;
            name: string;
            region: string | null;
            description: string | null;
            banner_url: string | null;
            accent_color: string | null;
            isOnline: boolean;
            created_at: Date;
        },
        isPremium: boolean,
        memberCount: number,
    ): ServerDirectoryEntry {
        return {
            id: server.id,
            name: server.name,
            region: server.region,
            description: server.description,
            isOnline: server.isOnline,
            memberCount,
            isPremium,
            appearance: visibleAppearance(server, isPremium),
            createdAt: server.created_at,
        };
    }

    /**
     * Servidores a que um utilizador pertence ou a que se candidatou.
     */
    async listMyMemberships(userId: string): Promise<ServerMembershipSummary[]> {
        const adesoes = await this.serverRepository.listOpenMembershipsOfUser(userId);

        const ids = adesoes
            .map((adesao) => adesao.serverId)
            .filter((id): id is string => id !== null);

        const cargos = await this.serverRepository.listUserScopedRoles(userId, ids);

        const porServidor = new Map(
            cargos.map((cargo) => [cargo.serverId, cargo.role.slug]),
        );

        return adesoes.flatMap((adesao) => {
            /**
             * Uma adesão de servidor tem sempre servidor preenchido — a
             * base de dados garante-o com um CHECK. O tipo não sabe disso,
             * e inventar valores aqui esconderia uma incoerência real.
             */
            if (!adesao.server) {
                return [];
            }

            return [
                {
                    serverId: adesao.server.id,
                    name: adesao.server.name,
                    region: adesao.server.region,
                    status: adesao.status as 'pending' | 'active',
                    role: porServidor.get(adesao.server.id) ?? null,
                    since: adesao.created_at,
                },
            ];
        });
    }

    /**
     * Aceita um pedido de entrada e atribui o cargo de membro.
     */
    async acceptRequest(
        serverId: string,
        userId: string,
        respondedBy: string,
    ): Promise<void> {
        const adesao = await this.requirePendingMembership(serverId, userId);

        await this.serverRepository.setMembershipStatus(
            adesao.id,
            MembershipStatus.active,
            respondedBy,
        );

        await this.roleAssignmentService.setScopedRole(userId, 'server_member', {
            serverId,
        });
    }

    async rejectRequest(
        serverId: string,
        userId: string,
        respondedBy: string,
    ): Promise<void> {
        const adesao = await this.requirePendingMembership(serverId, userId);

        await this.serverRepository.setMembershipStatus(
            adesao.id,
            MembershipStatus.rejected,
            respondedBy,
        );
    }

    /**
     * Sai do servidor por vontade própria.
     */
    async leave(serverId: string, userId: string): Promise<void> {
        const adesao = await this.requireActiveMembership(serverId, userId);

        /**
         * Sair sendo o único dono deixaria o servidor sem quem aceitasse
         * membros ou alterasse cargos, sem forma de o recuperar.
         */
        await this.roleAssignmentService.assertNotLastHolder(userId, 'server_owner', {
            serverId,
        });

        await this.serverRepository.setMembershipStatus(
            adesao.id,
            MembershipStatus.left,
            userId,
        );

        await this.roleAssignmentService.revokeScopedRoles(userId, { serverId });
    }

    /**
     * Remove um membro do servidor.
     */
    async removeMember(
        serverId: string,
        userId: string,
        removedBy: string,
    ): Promise<void> {
        if (userId === removedBy) {
            throw new ServerError(
                'CANNOT_MANAGE_SELF',
                'Para saíres do servidor usa a rota de saída.',
            );
        }

        const adesao = await this.requireActiveMembership(serverId, userId);

        await this.roleAssignmentService.assertNotLastHolder(userId, 'server_owner', {
            serverId,
        });

        await this.serverRepository.setMembershipStatus(
            adesao.id,
            MembershipStatus.left,
            removedBy,
        );

        await this.roleAssignmentService.revokeScopedRoles(userId, { serverId });
    }

    /**
     * Altera o cargo de um membro dentro do servidor.
     */
    async setMemberRole(
        serverId: string,
        userId: string,
        role: RoleKey,
        changedBy: string,
    ): Promise<void> {
        if (userId === changedBy) {
            throw new ServerError(
                'CANNOT_MANAGE_SELF',
                'Não podes alterar o teu próprio cargo.',
            );
        }

        await this.requireActiveMembership(serverId, userId);

        /**
         * Despromover o único dono tem o mesmo efeito que ele sair.
         */
        await this.roleAssignmentService.assertNotLastHolder(userId, 'server_owner', {
            serverId,
        });

        await this.roleAssignmentService.setScopedRole(userId, role, { serverId });
    }

    async listMembers(serverId: string): Promise<ServerMember[]> {
        await this.requireServer(serverId);

        const adesoes = await this.serverRepository.listMembers(
            serverId,
            MembershipStatus.active,
        );

        const cargos = await this.serverRepository.listScopedRoles(
            serverId,
            adesoes.map((adesao) => adesao.user.id),
        );

        const porUtilizador = new Map(
            cargos.map((cargo) => [cargo.userId, cargo.role.slug]),
        );

        return adesoes.map((adesao) => ({
            userId: adesao.user.id,
            username: adesao.user.username,
            avatarUrl: adesao.user.avatarUrl,
            role: porUtilizador.get(adesao.user.id) ?? null,
            joinedAt: adesao.created_at,
        }));
    }

    async listJoinRequests(serverId: string): Promise<ServerJoinRequest[]> {
        await this.requireServer(serverId);

        const pedidos = await this.serverRepository.listMembers(
            serverId,
            MembershipStatus.pending,
        );

        return pedidos.map((pedido) => ({
            userId: pedido.user.id,
            username: pedido.user.username,
            avatarUrl: pedido.user.avatarUrl,
            requestedAt: pedido.created_at,
        }));
    }

    private async requireServer(serverId: string): Promise<ServerRecord> {
        const server = await this.serverRepository.findById(serverId);

        if (!server) {
            throw new ServerError('SERVER_NOT_FOUND', 'Servidor não encontrado.');
        }

        return server;
    }

    private async requirePendingMembership(serverId: string, userId: string) {
        const adesao = await this.serverRepository.findOpenMembership(
            serverId,
            userId,
        );

        if (!adesao) {
            throw new ServerError(
                'MEMBERSHIP_NOT_FOUND',
                'Não existe pedido de entrada deste utilizador.',
            );
        }

        if (adesao.status !== MembershipStatus.pending) {
            throw new ServerError(
                'MEMBERSHIP_NOT_PENDING',
                'Este pedido já foi respondido.',
            );
        }

        return adesao;
    }

    private async requireActiveMembership(serverId: string, userId: string) {
        const adesao = await this.serverRepository.findOpenMembership(
            serverId,
            userId,
        );

        if (!adesao || adesao.status !== MembershipStatus.active) {
            throw new ServerError(
                'NOT_A_MEMBER',
                'Este utilizador não pertence ao servidor.',
            );
        }

        return adesao;
    }

    private async buildProfile(server: ServerRecord): Promise<ServerProfile> {
        const [entitlement, memberCount] = await Promise.all([
            this.subscriptionService.getEntitlement({ serverId: server.id }),
            this.serverRepository.countActiveMembers(server.id),
        ]);

        return {
            id: server.id,
            name: server.name,
            region: server.region,
            description: server.description,
            isOnline: server.isOnline,
            isPremium: entitlement.isPremium,
            appearance: visibleAppearance(server, entitlement.isPremium),
            memberCount,
            createdAt: server.created_at,
        };
    }
}
