import { MembershipStatus } from '@vicehub/database';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AuditService } from '../../audit/services/audit.service.js';
import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import type {
    AffiliationParamDto,
    CrewIdParamDto,
    RequestAffiliationDto,
    ServerIdParamDto,
} from '../dto/affiliation.dto.js';
import type { AffiliationService } from '../services/affiliation.service.js';

export class AffiliationController {
    constructor(
        private readonly affiliationService: AffiliationService,
        private readonly auditService: AuditService,
    ) { }

    /**
     * Uma decisão de filiação fica no rasto **das duas** comunidades.
     *
     * Não é duplicação por descuido: são duas perguntas diferentes, com
     * donos diferentes. Quem manda no servidor quer saber que crews
     * aceitou e pôs fora; quem lidera a crew, ao dar com ela fora de um
     * servidor, quer saber quem a tirou de lá — e essa pessoa não é da
     * crew, por isso o rasto dela nunca lhe chegaria.
     *
     * O nome que se guarda é o da **outra** comunidade: no rasto do
     * servidor fica a crew, no da crew fica o servidor. Repetir o nome
     * de quem está a ler não acrescenta nada.
     */
    private async registarFiliacao(
        request: FastifyRequest<{ Params: AffiliationParamDto }>,
        actorId: string,
        acao: 'accepted' | 'rejected' | 'removed',
        envolvidos: { crewName: string; serverName: string },
    ): Promise<void> {
        const contexto = AuditService.contextOf(request);

        await Promise.all([
            this.auditService.record({
                action: `server.affiliation.${acao}`,
                entityType: 'Server',
                entityId: request.params.serverId,
                actorId,
                after: {
                    crewId: request.params.crewId,
                    crewName: envolvidos.crewName,
                },
                ...contexto,
            }),
            this.auditService.record({
                action: `crew.affiliation.${acao}`,
                entityType: 'Crew',
                entityId: request.params.crewId,
                actorId,
                after: {
                    serverId: request.params.serverId,
                    serverName: envolvidos.serverName,
                },
                ...contexto,
            }),
        ]);
    }

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

        const envolvidos = await this.affiliationService.accept(
            request.params.serverId,
            request.params.crewId,
            user.id,
        );

        await this.registarFiliacao(request, user.id, 'accepted', envolvidos);

        reply.send({ status: 'active' });
    }

    async reject(
        request: FastifyRequest<{ Params: AffiliationParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const envolvidos = await this.affiliationService.reject(
            request.params.serverId,
            request.params.crewId,
            user.id,
        );

        await this.registarFiliacao(request, user.id, 'rejected', envolvidos);

        reply.send({ status: 'rejected' });
    }

    async remove(
        request: FastifyRequest<{ Params: AffiliationParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const envolvidos = await this.affiliationService.remove(
            request.params.serverId,
            request.params.crewId,
            user.id,
        );

        await this.registarFiliacao(request, user.id, 'removed', envolvidos);

        reply.code(204).send();
    }
}
