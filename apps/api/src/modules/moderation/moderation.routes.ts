import type { FastifyPluginAsync } from 'fastify';

import type { ModerationController } from './controllers/moderation.controller.js';
import {
    handleReportSchema,
    listReportsQuerySchema,
    moderationUserParamSchema,
    reportIdParamSchema,
    type HandleReportDto,
    type ListReportsQueryDto,
    type ModerationUserParamDto,
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

    /**
     * O historial de uma pessoa, do lado de quem escreve e do lado de
     * quem denuncia.
     *
     * A mesma porta da fila, e pela mesma razão: quem pode ver uma
     * denúncia é quem tem de a decidir, e estes números só existem
     * para essa decisão. Fora daqui não há nenhuma rota que os
     * devolva — um cadastro à vista de toda a gente era outra coisa,
     * que esta plataforma não tem.
     */
    fastify.get<{ Params: ModerationUserParamDto }>(
        '/users/:userId/history',
        {
            preHandler: [
                fastify.authenticate,
                fastify.authorizeAny('forum:moderate', 'marketplace:moderate'),
            ],
            schema: { params: moderationUserParamSchema },
        },
        controller.history.bind(controller),
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
