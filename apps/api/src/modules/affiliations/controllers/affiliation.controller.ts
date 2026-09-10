import { MembershipStatus } from '@vicehub/database';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import type {
    AffiliationParamDto,
    CrewIdParamDto,
    RequestAffiliationDto,
    ServerIdParamDto,
} from '../dto/affiliation.dto.js';
import type { AffiliationService } from '../services/affiliation.service.js';

export class AffiliationController {
    constructor(private readonly affiliationService: AffiliationService) { }

    /**
     * Onde a crew joga. É público: faz parte do perfil dela.
     */
    async getCrewAffiliation(
        request: FastifyRequest<{ Params: CrewIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const estado = await this.affiliationService.getCrewAffiliation(
            request.params.crewId,
        );

        reply.send({
            server: estado.servidor,
            pending: estado.pedido,
        });
    }

    async request(
        request: FastifyRequest<{
            Params: CrewIdParamDto;
            Body: RequestAffiliationDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.affiliationService.request(
            request.params.crewId,
            request.body.serverId,
            user.id,
        );

        reply.code(201).send({ status: 'pending' });
    }

    async cancelRequest(
        request: FastifyRequest<{ Params: CrewIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.affiliationService.cancelRequest(
            request.params.crewId,
            user.id,
        );

        reply.code(204).send();
    }

    async leave(
        request: FastifyRequest<{ Params: CrewIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.affiliationService.leave(request.params.crewId, user.id);

        reply.code(204).send();
    }

    /**
     * As crews que jogam neste servidor.
     */
    async listActive(
        request: FastifyRequest<{ Params: ServerIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.responder(request.params.serverId, MembershipStatus.active, reply);
    }

    /**
     * Quantas crews este servidor pode ter, e quantas já tem.
     *
     * Só para quem gere: é o plano do servidor que aqui se lê, e o
     * escalão que ele paga não é assunto de quem passa.
     */
    async getAllowance(
        request: FastifyRequest<{ Params: ServerIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        reply.send(
            await this.affiliationService.getCrewAllowance(
                request.params.serverId,
            ),
        );
    }

    /**
     * Os pedidos por responder deste servidor.
     */
    async listRequests(
        request: FastifyRequest<{ Params: ServerIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.responder(
            request.params.serverId,
            MembershipStatus.pending,
            reply,
        );
    }

    private async responder(
        serverId: string,
        status: MembershipStatus,
        reply: FastifyReply,
    ): Promise<void> {
        const entradas = await this.affiliationService.listOfServer(
            serverId,
            status,
        );

        reply.send(
            entradas.map((entrada) => ({
                crewId: entrada.crewId,
                crewName: entrada.crewName,
                crewTag: entrada.crewTag,
                status: entrada.status,
                requestedAt: entrada.requestedAt.toISOString(),
                respondedAt: entrada.respondedAt?.toISOString() ?? null,
            })),
        );
    }

    async accept(
        request: FastifyRequest<{ Params: AffiliationParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.affiliationService.accept(
            request.params.serverId,
            request.params.crewId,
            user.id,
        );

        reply.send({ status: 'active' });
    }

    async reject(
        request: FastifyRequest<{ Params: AffiliationParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.affiliationService.reject(
            request.params.serverId,
            request.params.crewId,
            user.id,
        );

        reply.send({ status: 'rejected' });
    }

    async remove(
        request: FastifyRequest<{ Params: AffiliationParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.affiliationService.remove(
            request.params.serverId,
            request.params.crewId,
            user.id,
        );

        reply.code(204).send();
    }
}
