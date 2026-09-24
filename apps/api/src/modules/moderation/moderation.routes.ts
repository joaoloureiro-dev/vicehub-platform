import type { FastifyPluginAsync } from 'fastify';

import type { ModerationController } from './controllers/moderation.controller.js';
import {
    handleReportSchema,
    listReportsQuerySchema,
    reportIdParamSchema,
    type HandleReportDto,
    type ListReportsQueryDto,
    type ReportIdParamDto,
} from './schemas/moderation.schemas.js';

interface ModerationRoutesOptions {
    controller: ModerationController;
}

/**
 * A fila de quem modera.
 *
 * Uma só, para a plataforma inteira: o fórum e o mercado são duas
 * superfícies onde o público escreve, e duas filas seriam duas caixas
 * de entrada para o mesmo trabalho.
 *
 * **Denunciar não se faz aqui.** O botão vive ao lado do que se
 * denuncia, e por isso as rotas de criação estão no módulo de cada
 * superfície — é lá que se sabe o que é uma pergunta e o que é um
 * anúncio. O que é comum é a fila, e é o que está aqui.
 *
 * Basta uma das duas permissões de moderação para a abrir. Exigir as
 * duas fechava a porta a quem só modera uma superfície, e exigir uma em
 * particular obrigava a escolher qual — sendo que a fila é a mesma.
 */
const moderationRoutes: FastifyPluginAsync<ModerationRoutesOptions> = async (
    fastify,
    { controller },
) => {
    fastify.get<{ Querystring: ListReportsQueryDto }>(
        '/reports',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorizeAny('forum:moderate', 'marketplace:moderate'),
            ],
            schema: { querystring: listReportsQuerySchema },
        },
        controller.listReports.bind(controller),
    );

    fastify.post<{ Params: ReportIdParamDto; Body: HandleReportDto }>(
        '/reports/:reportId',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorizeAny('forum:moderate', 'marketplace:moderate'),
            ],
            schema: {
                params: reportIdParamSchema,
                body: handleReportSchema,
            },
        },
        controller.handleReport.bind(controller),
    );
};

export default moderationRoutes;
