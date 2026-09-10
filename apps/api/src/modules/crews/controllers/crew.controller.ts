import type { FastifyReply, FastifyRequest } from 'fastify';

import type { UpdateAppearanceDto } from '../../../shared/appearance.js';
import { AuditService } from '../../audit/services/audit.service.js';
import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import type {
    CreateCrewDto,
    CrewIdParamDto,
    JoinRequestDto,
    RejectRequestDto,
    ListCrewsQueryDto,
    CrewMemberParamDto,
    SetMemberRoleDto,
    UpdateCrewDto,
} from '../dto/crew.dto.js';
import type { CrewService } from '../services/crew.service.js';
import type { CrewDirectoryEntry, CrewProfile } from '../types/crew.types.js';

export class CrewController {
    constructor(
        private readonly crewService: CrewService,
        private readonly auditService: AuditService,
    ) { }

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
            items: page.items.map((item) => this.toDirectoryDto(item)),
            featured: page.featured.map((item) => this.toDirectoryDto(item)),
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
                /** Ausente enquanto a candidatura estiver por responder. */
                respondedAt: adesao.respondedAt?.toISOString() ?? null,
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

    /**
     * PATCH /crews/:crewId/appearance
     */
    async updateAppearance(
        request: FastifyRequest<{ Params: CrewIdParamDto; Body: UpdateAppearanceDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        reply.send(
            this.toProfileDto(
                await this.crewService.updateAppearance(
                    request.params.crewId,
                    request.body,
                ),
            ),
        );
    }

    async remove(
        request: FastifyRequest<{ Params: CrewIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const { crewId } = request.params;

        /**
         * O nome é lido antes de a crew desaparecer do diretório: um
         * rasto que diga apenas o identificador não responde à pergunta
         * que se vai fazer daqui a seis meses, que é qual das crews é
         * que era esta.
         */
        const { name, tag } = await this.crewService.getProfile(crewId);

        await this.crewService.deleteCrew(crewId, user.id);

        await this.auditService.record({
            action: 'crew.deleted',
            entityType: 'Crew',
            entityId: crewId,
            actorId: user.id,
            before: { name, tag },
            ...AuditService.contextOf(request),
        });

        reply.status(204).send();
    }

    async listXp(
        request: FastifyRequest<{ Params: CrewIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const ganhos = await this.crewService.listXpAwards(
            request.params.crewId,
        );

        reply.send(
            ganhos.map((ganho) => ({
                ...ganho,
                at: ganho.at.toISOString(),
            })),
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
        request: FastifyRequest<{ Params: CrewIdParamDto; Body: JoinRequestDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.crewService.requestToJoin(
            request.params.crewId,
            user.id,
            /**
             * O corpo é opcional na rota, por isso pode nem existir —
             * quem já usa esta rota sem corpo nenhum continua a poder.
             */
            request.body?.message,
        );

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
        request: FastifyRequest<{
            Params: CrewMemberParamDto;
            Body: RejectRequestDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.crewService.rejectRequest(
            request.params.crewId,
            request.params.userId,
            user.id,
            request.body?.reason,
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

    private toDirectoryDto(entry: CrewDirectoryEntry) {
        return {
            ...entry,
            createdAt: entry.createdAt.toISOString(),
            /** Ausente quer dizer que não há anúncio no ar. */
            recruitingSince: entry.recruitingSince?.toISOString() ?? null,
        };
    }

    /**
     * O xp é BigInt e sai como string, para não perder precisão.
     */
    private toProfileDto(profile: CrewProfile) {
        return {
            ...profile,
            xp: profile.xp.toString(),
            levelXp: profile.levelXp.toString(),
            /** Ausente quer dizer que já não há nível seguinte. */
            nextLevelXp: profile.nextLevelXp?.toString() ?? null,
            createdAt: profile.createdAt.toISOString(),
            /** Ausente quer dizer que não há anúncio no ar. */
            recruitingSince: profile.recruitingSince?.toISOString() ?? null,
        };
    }
}
