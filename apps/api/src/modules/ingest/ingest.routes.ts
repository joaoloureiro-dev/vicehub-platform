import type { FastifyPluginAsync } from 'fastify';

import type { IngestController } from './controllers/ingest.controller.js';
import type {
    ApiKeyParamDto,
    CreateApiKeyDto,
    HeartbeatDto,
    ServerIdParamDto,
} from './dto/ingest.dto.js';
import {
    apiKeyParamSchema,
    createApiKeySchema,
    heartbeatSchema,
    serverIdParamSchema,
} from './schemas/ingest.schemas.js';

interface IngestRoutesOptions {
    controller: IngestController;
}

/**
 * Rotas da ingestão.
 *
 * São dois conjuntos com **duas formas de entrar diferentes**, e é por
 * isso que vivem juntos e separados:
 *
 * - gerir chaves é coisa de pessoas, debaixo de `/servers/:serverId`,
 *   e exige `server:manage` como o resto da gestão do servidor;
 * - reportar é coisa de máquinas, debaixo de `/ingest`, e a chave é a
 *   única forma de entrar. Não há sessão, não há cargos.
 */
const ingestRoutes: FastifyPluginAsync<IngestRoutesOptions> = async (
    fastify,
    options,
) => {
    const { controller } = options;

    fastify.post<{ Params: ServerIdParamDto; Body: CreateApiKeyDto }>(
        '/api/v1/servers/:serverId/api-keys',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('server:manage'),
            ],
            schema: { params: serverIdParamSchema, body: createApiKeySchema },
        },
        controller.createKey.bind(controller),
    );

    /**
     * A listagem não devolve nada que sirva para usar uma chave — só o
     * prefixo, para se saber qual é qual.
     */
    fastify.get<{ Params: ServerIdParamDto }>(
        '/api/v1/servers/:serverId/api-keys',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('server:manage'),
            ],
            schema: { params: serverIdParamSchema },
        },
        controller.listKeys.bind(controller),
    );

    fastify.delete<{ Params: ApiKeyParamDto }>(
        '/api/v1/servers/:serverId/api-keys/:apiKeyId',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorize('server:manage'),
            ],
            schema: { params: apiKeyParamSchema },
        },
        controller.revokeKey.bind(controller),
    );

    /**
     * Daqui para baixo quem fala é o servidor, e não uma pessoa.
     */
    fastify.get(
        '/api/v1/ingest/me',
        { preHandler: [fastify.authenticateServer] },
        controller.me.bind(controller),
    );

    fastify.post<{ Body: HeartbeatDto }>(
        '/api/v1/ingest/heartbeat',
        {
            preHandler: [fastify.authenticateServer],
            schema: { body: heartbeatSchema },
        },
        controller.heartbeat.bind(controller),
    );
};

export default ingestRoutes;
