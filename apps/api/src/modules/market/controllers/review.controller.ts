import type { FastifyReply, FastifyRequest } from 'fastify';

import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import type { AuthorizationService } from '../../authorization/services/authorization.service.js';
import type { ModerationController } from '../../moderation/controllers/moderation.controller.js';
import type { ReportService } from '../../moderation/services/report.service.js';
import type { CreateReportDto } from '../../moderation/schemas/moderation.schemas.js';
import { MarketError } from '../errors/market.errors.js';
import type {
    CreateReviewDto,
    ListReviewsQueryDto,
    ListingIdParamDto,
    ReplyToReviewDto,
    ReviewIdParamDto,
    UsernameParamDto,
} from '../schemas/market.schemas.js';
import type { ReviewService } from '../services/review.service.js';
import type { UserLookup } from '../repositories/user-lookup.js';

/** Que resposta HTTP corresponde a cada recusa. */
const ESTADO: Record<string, number> = {
    LISTING_NOT_FOUND: 404,
    REVIEW_NOT_FOUND: 404,
    USER_NOT_FOUND: 404,
    NOT_YOURS: 403,
    IS_YOURS: 409,
    NOT_SOLD: 409,
    NO_DEAL: 409,
    ALREADY_REVIEWED: 409,
    ALREADY_REPLIED: 409,
    SELLER_GONE: 409,
};

export class ReviewController {
    constructor(
        private readonly reviewService: ReviewService,
        private readonly userLookup: UserLookup,
        private readonly authorizationService: AuthorizationService,
        private readonly reportService: ReportService,
        private readonly moderationController: ModerationController,
    ) { }

    private podeModerar(request: FastifyRequest): boolean {
        const reunidas = request.effectivePermissions;

        if (reunidas === null) {
            return false;
        }

        return this.authorizationService.hasPermissions(reunidas, [
            'marketplace:moderate',
        ]);
    }

    async create(
        request: FastifyRequest<{
            Params: ListingIdParamDto;
            Body: CreateReviewDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        try {
            const criada = await this.reviewService.createReview(
                request.params.listingId,
                user.id,
                request.body.rating,
                request.body.body,
            );

            reply.code(201).send(criada);
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    async reply(
        request: FastifyRequest<{
            Params: ReviewIdParamDto;
            Body: ReplyToReviewDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        try {
            const respondida = await this.reviewService.reply(
                request.params.reviewId,
                user.id,
                request.body.body,
            );

            reply.send(respondida);
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    /**
     * As avaliações de uma pessoa, pelo nome de utilizador.
     *
     * Pelo nome e não pelo identificador porque é o perfil público que
     * as mostra, e é o nome que está no endereço desse perfil. Ler não
     * pede sessão: uma avaliação é pública, e quem está a decidir se
     * compra a alguém pode nem ter conta.
     */
    async list(
        request: FastifyRequest<{
            Params: UsernameParamDto;
            Querystring: ListReviewsQueryDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        const pessoa = await this.userLookup.findByUsername(
            request.params.username,
        );

        if (pessoa === null) {
            reply
                .code(404)
                .send({
                    code: 'USER_NOT_FOUND',
                    message: 'Não encontrámos esta pessoa.',
                });

            return;
        }

        const pagina = await this.reviewService.listForUser(
            pessoa.id,
            request.query.page,
        );

        reply.send({
            reviews: pagina.avaliacoes.map((avaliacao) => ({
                ...avaliacao,
                createdAt: avaliacao.createdAt.toISOString(),
                repliedAt:
                    avaliacao.repliedAt === null
                        ? null
                        : avaliacao.repliedAt.toISOString(),
            })),
            summary: pagina.resumo,
            page: pagina.pagina,
            pages: pagina.paginas,
            total: pagina.total,
        });
    }

    async remove(
        request: FastifyRequest<{ Params: ReviewIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        try {
            await this.reviewService.removeReview(
                request.params.reviewId,
                user.id,
                this.podeModerar(request),
            );

            reply.code(204).send();
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    async report(
        request: FastifyRequest<{
            Params: ReviewIdParamDto;
            Body: CreateReportDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        try {
            const criada = await this.reportService.report(
                { kind: 'review', id: request.params.reviewId },
                user.id,
                request.body.reason,
                request.body.note,
            );

            reply.code(201).send(criada);
        } catch (erro: unknown) {
            this.moderationController.responder(erro, reply);
        }
    }

    private responder(erro: unknown, reply: FastifyReply): void {
        if (erro instanceof MarketError) {
            reply
                .code(ESTADO[erro.code] ?? 400)
                .send({ code: erro.code, message: erro.message });

            return;
        }

        throw erro;
    }
}
