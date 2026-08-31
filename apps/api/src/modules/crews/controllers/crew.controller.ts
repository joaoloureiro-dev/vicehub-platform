import type { FastifyReply, FastifyRequest } from 'fastify';

import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import type {
    CreateCrewDto,
    CrewIdParamDto,
    ListCrewsQueryDto,
    CrewMemberParamDto,
    SetMemberRoleDto,
    UpdateCrewDto,
} from '../dto/crew.dto.js';
import type { CrewService } from '../services/crew.service.js';
import type { CrewProfile } from '../types/crew.types.js';

export class CrewController {
    constructor(private readonly crewService: CrewService) { }

    async create(
        request: FastifyRequest<{ Body: CreateCrewDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const profile = await this.crewService.createCrew({
            ...request.body,
            founderId: user.id,
        });

        reply.code(201).send(this.toProfileDto(profile));
    }

    async listDirectory(
        request: FastifyRequest<{ Querystring: ListCrewsQueryDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const page = await this.crewService.listDirectory(request.query);

        reply.send({
            ...page,
            items: page.items.map((item) => ({
                ...item,
                createdAt: item.createdAt.toISOString(),
            })),
        });
    }

    async listMyMemberships(
        request: FastifyRequest,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const adesoes = await this.crewService.listMyMemberships(user.id);

        reply.send(
            adesoes.map((adesao) => ({
                ...adesao,
                since: adesao.since.toISOString(),
            })),
        );
    }

    async withdrawJoinRequest(
        request: FastifyRequest<{ Params: CrewIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.crewService.withdrawJoinRequest(request.params.crewId, user.id);

        reply.status(204).send();
    }

    async getProfile(
        request: FastifyRequest<{ Params: CrewIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        reply.send(
            this.toProfileDto(await this.crewService.getProfile(request.params.crewId)),
        );
    }

    async update(
        request: FastifyRequest<{ Params: CrewIdParamDto; Body: UpdateCrewDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        reply.send(
            this.toProfileDto(
                await this.crewService.updateCrew(request.params.crewId, request.body),
            ),
        );
    }

    async listMembers(
        request: FastifyRequest<{ Params: CrewIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const membros = await this.crewService.listMembers(request.params.crewId);

        reply.send(
            membros.map((membro) => ({
                ...membro,
                joinedAt: membro.joinedAt.toISOString(),
            })),
        );
    }

    async listJoinRequests(
        request: FastifyRequest<{ Params: CrewIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const pedidos = await this.crewService.listJoinRequests(request.params.crewId);

        reply.send(
            pedidos.map((pedido) => ({
                ...pedido,
                requestedAt: pedido.requestedAt.toISOString(),
            })),
        );
    }

    async requestToJoin(
        request: FastifyRequest<{ Params: CrewIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.crewService.requestToJoin(request.params.crewId, user.id);

        reply.code(202).send();
    }

    async leave(
        request: FastifyRequest<{ Params: CrewIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.crewService.leave(request.params.crewId, user.id);

        reply.status(204).send();
    }

    async acceptRequest(
        request: FastifyRequest<{ Params: CrewMemberParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.crewService.acceptRequest(
            request.params.crewId,
            request.params.userId,
            user.id,
        );

        reply.status(204).send();
    }

    async rejectRequest(
        request: FastifyRequest<{ Params: CrewMemberParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.crewService.rejectRequest(
            request.params.crewId,
            request.params.userId,
            user.id,
        );

        reply.status(204).send();
    }

    async removeMember(
        request: FastifyRequest<{ Params: CrewMemberParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.crewService.removeMember(
            request.params.crewId,
            request.params.userId,
            user.id,
        );

        reply.status(204).send();
    }

    async setMemberRole(
        request: FastifyRequest<{
            Params: CrewMemberParamDto;
            Body: SetMemberRoleDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.crewService.setMemberRole(
            request.params.crewId,
            request.params.userId,
            request.body.role,
            user.id,
        );

        reply.status(204).send();
    }

    /**
     * O xp é BigInt e sai como string, para não perder precisão.
     */
    private toProfileDto(profile: CrewProfile) {
        return {
            ...profile,
            xp: profile.xp.toString(),
            createdAt: profile.createdAt.toISOString(),
        };
    }
}
