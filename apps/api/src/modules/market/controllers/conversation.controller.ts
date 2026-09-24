import type { FastifyReply, FastifyRequest } from 'fastify';

import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import type { AuthorizationService } from '../../authorization/services/authorization.service.js';
import type { ModerationController } from '../../moderation/controllers/moderation.controller.js';
import type { ReportService } from '../../moderation/services/report.service.js';
import type { CreateReportDto } from '../../moderation/schemas/moderation.schemas.js';
import { MarketError } from '../errors/market.errors.js';
import type {
    ConversationIdParamDto,
    ListConversationsQueryDto,
    ListingIdParamDto,
    MessageIdParamDto,
    SendMessageDto,
} from '../schemas/market.schemas.js';
import type { ConversationService } from '../services/conversation.service.js';
import type { ConversaResumo, ConversaView } from '../types/market.types.js';

/** Que resposta HTTP corresponde a cada recusa. */
const ESTADO: Record<string, number> = {
    LISTING_NOT_FOUND: 404,
    CONVERSATION_NOT_FOUND: 404,
    MESSAGE_NOT_FOUND: 404,
    NOT_YOURS: 403,
    IS_YOURS: 409,
};

/** O preço sai como texto, pela razão de sempre: é `BigInt`. */
const anuncioEmJson = (anuncio: ConversaView['listing']) => ({
    ...anuncio,
    price: anuncio.price.toString(),
});

export class ConversationController {
    constructor(
        private readonly conversationService: ConversationService,
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

    async open(
        request: FastifyRequest<{ Params: ListingIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        try {
            const conversa = await this.conversationService.openConversation(
                request.params.listingId,
                user.id,
            );

            reply.code(201).send(conversa);
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    async get(
        request: FastifyRequest<{ Params: ConversationIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        try {
            const conversa = await this.conversationService.getConversation(
                request.params.conversationId,
                user.id,
            );

            reply.send({
                ...conversa,
                listing: anuncioEmJson(conversa.listing),
                messages: conversa.messages.map((mensagem) => ({
                    ...mensagem,
                    createdAt: mensagem.createdAt.toISOString(),
                })),
            });
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    async send(
        request: FastifyRequest<{
            Params: ConversationIdParamDto;
            Body: SendMessageDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        try {
            const mensagem = await this.conversationService.sendMessage(
                request.params.conversationId,
                user.id,
                request.body.body,
            );

            reply.code(201).send(mensagem);
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    async list(
        request: FastifyRequest<{ Querystring: ListConversationsQueryDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const pagina = await this.conversationService.listConversations(
            user.id,
            request.query.page,
        );

        reply.send({
            conversations: pagina.conversas.map((conversa: ConversaResumo) => ({
                ...conversa,
                listing: anuncioEmJson(conversa.listing),
                ultima:
                    conversa.ultima === null
                        ? null
                        : {
                            ...conversa.ultima,
                            createdAt: conversa.ultima.createdAt.toISOString(),
                        },
                updatedAt: conversa.updatedAt.toISOString(),
            })),
            page: pagina.pagina,
            pages: pagina.paginas,
            total: pagina.total,
        });
    }

    async removeMessage(
        request: FastifyRequest<{ Params: MessageIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        try {
            await this.conversationService.removeMessage(
                request.params.messageId,
                user.id,
                this.podeModerar(request),
            );

            reply.code(204).send();
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    /**
     * Denunciar uma mensagem.
     *
     * Quem está na conversa é verificado no serviço das denúncias, e
     * não aqui: é lá que vive a regra de uma superfície privada só se
     * denunciar por dentro.
     */
    async report(
        request: FastifyRequest<{
            Params: MessageIdParamDto;
            Body: CreateReportDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        try {
            const criada = await this.reportService.report(
                { kind: 'message', id: request.params.messageId },
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
