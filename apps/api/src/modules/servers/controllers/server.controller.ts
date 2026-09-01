import type { FastifyReply, FastifyRequest } from 'fastify';

import type { UpdateAppearanceDto } from '../../../shared/appearance.js';
import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import type {
    CreateServerDto,
    ListServersQueryDto,
    ServerIdParamDto,
    ServerMemberParamDto,
    SetServerMemberRoleDto,
    UpdateServerDto,
} from '../dto/server.dto.js';
import type { ServerService } from '../services/server.service.js';
import type {
    ServerDirectoryEntry,
    ServerProfile,
} from '../types/server.types.js';

export class ServerController {
    constructor(private readonly serverService: ServerService) { }

    async create(
        request: FastifyRequest<{ Body: CreateServerDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const profile = await this.serverService.createServer({
            ...request.body,
            ownerId: user.id,
        });

        reply.code(201).send(this.toProfileDto(profile));
    }

    async listDirectory(
        request: FastifyRequest<{ Querystring: ListServersQueryDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const page = await this.serverService.listDirectory(request.query);

        reply.send({
            ...page,
            items: page.items.map((item) => this.toDirectoryDto(item)),
            featured: page.featured.map((item) => this.toDirectoryDto(item)),
        });
    }

    async listMyMemberships(
        request: FastifyRequest,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const adesoes = await this.serverService.listMyMemberships(user.id);

        reply.send(
            adesoes.map((adesao) => ({
                ...adesao,
                since: adesao.since.toISOString(),
            })),
        );
    }

    async getProfile(
        request: FastifyRequest<{ Params: ServerIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        reply.send(
            this.toProfileDto(
                await this.serverService.getProfile(request.params.serverId),
            ),
        );
    }

    async update(
        request: FastifyRequest<{ Params: ServerIdParamDto; Body: UpdateServerDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        reply.send(
            this.toProfileDto(
                await this.serverService.updateServer(
                    request.params.serverId,
                    request.body,
                ),
            ),
        );
    }

    async listMembers(
        request: FastifyRequest<{ Params: ServerIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const membros = await this.serverService.listMembers(request.params.serverId);

        reply.send(
            membros.map((membro) => ({
                ...membro,
                joinedAt: membro.joinedAt.toISOString(),
            })),
        );
    }

    async listJoinRequests(
        request: FastifyRequest<{ Params: ServerIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const pedidos = await this.serverService.listJoinRequests(
            request.params.serverId,
        );

        reply.send(
            pedidos.map((pedido) => ({
                ...pedido,
                requestedAt: pedido.requestedAt.toISOString(),
            })),
        );
    }

    async requestToJoin(
        request: FastifyRequest<{ Params: ServerIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.serverService.requestToJoin(request.params.serverId, user.id);

        reply.code(202).send();
    }

    async withdrawJoinRequest(
        request: FastifyRequest<{ Params: ServerIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.serverService.withdrawJoinRequest(
            request.params.serverId,
            user.id,
        );

        reply.status(204).send();
    }

    async leave(
        request: FastifyRequest<{ Params: ServerIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.serverService.leave(request.params.serverId, user.id);

        reply.status(204).send();
    }

    async acceptRequest(
        request: FastifyRequest<{ Params: ServerMemberParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.serverService.acceptRequest(
            request.params.serverId,
            request.params.userId,
            user.id,
        );

        reply.status(204).send();
    }

    async rejectRequest(
        request: FastifyRequest<{ Params: ServerMemberParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.serverService.rejectRequest(
            request.params.serverId,
            request.params.userId,
            user.id,
        );

        reply.status(204).send();
    }

    async removeMember(
        request: FastifyRequest<{ Params: ServerMemberParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.serverService.removeMember(
            request.params.serverId,
            request.params.userId,
            user.id,
        );

        reply.status(204).send();
    }

    async setMemberRole(
        request: FastifyRequest<{
            Params: ServerMemberParamDto;
            Body: SetServerMemberRoleDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.serverService.setMemberRole(
            request.params.serverId,
            request.params.userId,
            request.body.role,
            user.id,
        );

        reply.status(204).send();
    }

    /**
     * PATCH /servers/:serverId/appearance
     */
    async updateAppearance(
        request: FastifyRequest<{
            Params: ServerIdParamDto;
            Body: UpdateAppearanceDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        reply.send(
            this.toProfileDto(
                await this.serverService.updateAppearance(
                    request.params.serverId,
                    request.body,
                ),
            ),
        );
    }

    private toDirectoryDto(entry: ServerDirectoryEntry) {
        return {
            ...entry,
            createdAt: entry.createdAt.toISOString(),
        };
    }

    private toProfileDto(profile: ServerProfile) {
        return {
            ...profile,
            createdAt: profile.createdAt.toISOString(),
        };
    }
}
