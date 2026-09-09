import type { FastifyReply, FastifyRequest } from 'fastify';

import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import type {
    ApiKeyParamDto,
    CreateApiKeyDto,
    HeartbeatDto,
    ServerIdParamDto,
} from '../dto/ingest.dto.js';
import { requireServerContext } from '../http/server-context.guard.js';
import type { IngestService } from '../services/ingest.service.js';

export class IngestController {
    constructor(private readonly ingestService: IngestService) { }

    /**
     * POST /servers/:serverId/api-keys — cria uma chave.
     *
     * É a **única** resposta em que a chave inteira aparece. A partir
     * daqui só existe o resumo dela, e a listagem mostra o prefixo.
     */
    async createKey(
        request: FastifyRequest<{
            Params: ServerIdParamDto;
            Body: CreateApiKeyDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const chave = await this.ingestService.createKey(
            request.params.serverId,
            request.body.label,
            user.id,
        );

        reply.code(201).send({
            id: chave.id,
            label: chave.label,
            prefix: chave.prefix,
            createdAt: chave.createdAt.toISOString(),
            key: chave.key,
        });
    }

    async listKeys(
        request: FastifyRequest<{ Params: ServerIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const chaves = await this.ingestService.listKeys(
            request.params.serverId,
        );

        reply.send(
            chaves.map((chave) => ({
                id: chave.id,
                label: chave.label,
                prefix: chave.prefix,
                lastUsedAt: chave.last_used_at?.toISOString() ?? null,
                revokedAt: chave.revoked_at?.toISOString() ?? null,
                createdAt: chave.created_at.toISOString(),
            })),
        );
    }

    async revokeKey(
        request: FastifyRequest<{ Params: ApiKeyParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.ingestService.revokeKey(
            request.params.serverId,
            request.params.apiKeyId,
            user.id,
        );

        reply.code(204).send();
    }

    /**
     * GET /ingest/me — que servidor é este.
     *
     * Serve para quem instala o recurso confirmar que a chave é a do
     * servidor certo antes de a pôr a reportar seja o que for.
     */
    async me(request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const { serverId } = requireServerContext(request);

        const servidor = await this.ingestService.describeServer(serverId);

        reply.send({ serverId: servidor.id, name: servidor.name });
    }

    /**
     * POST /ingest/heartbeat — o servidor diz que está de pé.
     */
    async heartbeat(
        request: FastifyRequest<{ Body: HeartbeatDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { serverId } = requireServerContext(request);

        await this.ingestService.heartbeat(
            serverId,
            request.body.playersOnline,
        );

        reply.send({ ok: true });
    }
}
