import type { FastifyReply, FastifyRequest } from 'fastify';

import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import { ModerationError } from '../errors/moderation.errors.js';
import type {
    HandleReportDto,
    ListReportsQueryDto,
    ReportIdParamDto,
} from '../schemas/moderation.schemas.js';
import type { ReportService } from '../services/report.service.js';

/** Que resposta HTTP corresponde a cada recusa. */
const ESTADO: Record<string, number> = {
    TARGET_NOT_FOUND: 404,
    REPORT_NOT_FOUND: 404,
    ALREADY_REPORTED: 409,
    REPORT_ALREADY_HANDLED: 409,
    IS_YOURS: 409,
};

export class ModerationController {
    constructor(private readonly reportService: ReportService) { }

    async listReports(
        request: FastifyRequest<{ Querystring: ListReportsQueryDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { status, page } = request.query;

        const pagina = await this.reportService.listReports(status, page);

        reply.send({
            reports: pagina.denuncias.map((denuncia) => ({
                ...denuncia,
                createdAt: denuncia.createdAt.toISOString(),
                handledAt:
                    denuncia.handledAt === null
                        ? null
                        : denuncia.handledAt.toISOString(),
            })),
            page: pagina.pagina,
            pages: pagina.paginas,
            total: pagina.total,
        });
    }

    async handleReport(
        request: FastifyRequest<{
            Params: ReportIdParamDto;
            Body: HandleReportDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        try {
            await this.reportService.handleReport(
                request.params.reportId,
                user.id,
                request.body.outcome,
            );

            reply.code(204).send();
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    /**
     * A recusa de uma denúncia, traduzida em HTTP.
     *
     * Exportada para os módulos que criam denúncias — o fórum e o
     * mercado — responderem exatamente o mesmo código para o mesmo
     * caso. Sem isto, denunciar um anúncio já retirado e denunciar uma
     * resposta já retirada davam dois estados diferentes.
     */
    responder(erro: unknown, reply: FastifyReply): void {
        if (erro instanceof ModerationError) {
            reply
                .code(ESTADO[erro.code] ?? 400)
                .send({ code: erro.code, message: erro.message });

            return;
        }

        throw erro;
    }
}
