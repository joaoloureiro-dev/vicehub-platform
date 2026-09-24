import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import { ModerationController } from './controllers/moderation.controller.js';
import { ReportRepository } from './repositories/report.repository.js';
import { ReportService } from './services/report.service.js';
import moderationRoutes from './moderation.routes.js';

/**
 * Módulo da moderação.
 *
 * Uma fila só para a plataforma inteira. O serviço é construído aqui e
 * também é usado pelo fórum e pelo mercado, que têm os botões de
 * denunciar ao lado do que se denuncia — mas a decisão, a ordem da fila
 * e o que conta como alvo vivem todos aqui.
 */
export const construirReportService = (
    prisma: ConstructorParameters<typeof ReportRepository>[0],
): ReportService => new ReportService(new ReportRepository(prisma));

const moderationModule: FastifyPluginAsync = async (fastify) => {
    await fastify.register(moderationRoutes, {
        prefix: '/api/v1/moderation',
        controller: new ModerationController(
            construirReportService(fastify.prisma),
        ),
    });
};

export default fp(moderationModule, {
    name: 'moderation-module',
    dependencies: ['prisma-plugin', 'authenticate-plugin', 'authorize-plugin'],
});
