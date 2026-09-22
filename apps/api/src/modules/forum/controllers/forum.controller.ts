import type { FastifyReply, FastifyRequest } from 'fastify';

import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import type { AuthorizationService } from '../../authorization/services/authorization.service.js';
import { ForumError } from '../errors/forum.errors.js';
import type {
    CreateReplyDto,
    CreateReportDto,
    CreateTopicDto,
    HandleReportDto,
    ListReportsQueryDto,
    ListTopicsQueryDto,
    ReplyIdParamDto,
    ReportIdParamDto,
    TopicIdParamDto,
} from '../schemas/forum.schemas.js';
import type { ForumService } from '../services/forum.service.js';

/** Que resposta HTTP corresponde a cada recusa. */
const ESTADO: Record<string, number> = {
    TOPIC_NOT_FOUND: 404,
    REPLY_NOT_FOUND: 404,
    REPORT_NOT_FOUND: 404,
    TOPIC_LOCKED: 409,
    ALREADY_REPORTED: 409,
    REPORT_ALREADY_HANDLED: 409,
    NOT_YOURS: 403,
    IS_YOURS: 409,
};

export class ForumController {
    constructor(
        private readonly forumService: ForumService,
        private readonly authorizationService: AuthorizationService,
    ) { }

    /**
     * Se quem faz o pedido pode moderar.
     *
     * Passa pelo serviço de autorização e não por uma leitura direta do
     * conjunto: é lá que está a regra de o `system:manage` cobrir tudo, e
     * lê-lo à mão aqui escrevia essa regra uma segunda vez — que é como
     * um administrador acaba a não poder fazer uma coisa que devia.
     *
     * As permissões já foram reunidas pelo preHandler deste pedido, por
     * isso isto não custa uma consulta.
     */
    private podeModerar(request: FastifyRequest): boolean {
        const reunidas = request.effectivePermissions;

        if (reunidas === null) {
            return false;
        }

        return this.authorizationService.hasPermissions(reunidas, [
            'forum:moderate',
        ]);
    }

    async list(
        request: FastifyRequest<{ Querystring: ListTopicsQueryDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const pagina = await this.forumService.listTopics(request.query.page);

        reply.send({
            topics: pagina.topicos.map((topico) => ({
                ...topico,
                createdAt: topico.createdAt.toISOString(),
                lastActivityAt: topico.lastActivityAt.toISOString(),
            })),
            page: pagina.pagina,
            pages: pagina.paginas,
            total: pagina.total,
        });
    }

    async get(
        request: FastifyRequest<{ Params: TopicIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        try {
            const topico = await this.forumService.getTopic(
                request.params.topicId,
            );

            reply.send({
                ...topico,
                createdAt: topico.createdAt.toISOString(),
                replies: topico.replies.map((resposta) => ({
                    ...resposta,
                    createdAt: resposta.createdAt.toISOString(),
                })),
            });
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    async create(
        request: FastifyRequest<{ Body: CreateTopicDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const criado = await this.forumService.createTopic(request.body, user.id);

        reply.code(201).send(criado);
    }

    async reply(
        request: FastifyRequest<{ Params: TopicIdParamDto; Body: CreateReplyDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        try {
            const criada = await this.forumService.reply(
                request.params.topicId,
                request.body.body,
                user.id,
            );

            reply.code(201).send(criada);
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    /**
     * Se quem pergunta modera.
     *
     * Existe para o ecrã poder mostrar as ferramentas a quem as tem, em
     * vez de as mostrar a toda a gente e deixar a API recusar — que é o
     * que acontecia até aqui, e fazia com que **ninguém** as visse: não
     * havia botão nenhum de moderação em lado nenhum, e a única forma
     * de moderar era falar com a API à mão.
     *
     * Rota à parte e não um campo na leitura do tópico, porque ler não
     * pede sessão. Pôr isto lá obrigava a autenticar quem chega de uma
     * pesquisa só para lhe dizer que não modera.
     */
    async moderation(
        request: FastifyRequest,
        reply: FastifyReply,
    ): Promise<void> {
        reply.send({ canModerate: this.podeModerar(request) });
    }

    async lock(
        request: FastifyRequest<{ Params: TopicIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.mudarFecho(request, reply, true);
    }

    async unlock(
        request: FastifyRequest<{ Params: TopicIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.mudarFecho(request, reply, false);
    }

    private async mudarFecho(
        request: FastifyRequest<{ Params: TopicIdParamDto }>,
        reply: FastifyReply,
        fechar: boolean,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        try {
            await this.forumService.setLock(
                request.params.topicId,
                user.id,
                fechar,
            );

            reply.code(204).send();
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    async reportTopic(
        request: FastifyRequest<{
            Params: TopicIdParamDto;
            Body: CreateReportDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.denunciar(
            request,
            reply,
            { topicId: request.params.topicId },
        );
    }

    async reportReply(
        request: FastifyRequest<{
            Params: ReplyIdParamDto;
            Body: CreateReportDto;
        }>,
        reply: FastifyReply,
    ): Promise<void> {
        await this.denunciar(
            request,
            reply,
            { replyId: request.params.replyId },
        );
    }

    private async denunciar(
        request: FastifyRequest<{ Body: CreateReportDto }>,
        reply: FastifyReply,
        alvo: { topicId: string } | { replyId: string },
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        try {
            const criada = await this.forumService.report(
                alvo,
                user.id,
                request.body.reason,
                request.body.note,
            );

            reply.code(201).send(criada);
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    async listReports(
        request: FastifyRequest<{ Querystring: ListReportsQueryDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const pagina = await this.forumService.listReports(
            request.query.status,
            request.query.page,
        );

        reply.send({
            reports: pagina.denuncias.map((denuncia) => ({
                ...denuncia,
                createdAt: denuncia.createdAt.toISOString(),
                handledAt: denuncia.handledAt?.toISOString() ?? null,
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
            await this.forumService.handleReport(
                request.params.reportId,
                user.id,
                request.body.outcome,
            );

            reply.code(204).send();
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    async removeTopic(
        request: FastifyRequest<{ Params: TopicIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        try {
            await this.forumService.removeTopic(
                request.params.topicId,
                user.id,
                this.podeModerar(request),
            );

            reply.code(204).send();
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    async removeReply(
        request: FastifyRequest<{ Params: ReplyIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        try {
            await this.forumService.removeReply(
                request.params.replyId,
                user.id,
                this.podeModerar(request),
            );

            reply.code(204).send();
        } catch (erro: unknown) {
            this.responder(erro, reply);
        }
    }

    private responder(erro: unknown, reply: FastifyReply): void {
        if (!(erro instanceof ForumError)) {
            throw erro;
        }

        reply.code(ESTADO[erro.code] ?? 400).send({
            statusCode: ESTADO[erro.code] ?? 400,
            code: erro.code,
            message: erro.message,
        });
    }
}
