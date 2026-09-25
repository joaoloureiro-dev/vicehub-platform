import type { FastifyReply, FastifyRequest } from 'fastify';

import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import type {
    ListNotificationsQueryDto,
    NotificationIdParamDto,
} from '../schemas/notification.schemas.js';
import type { NotificationService } from '../services/notification.service.js';

export class NotificationController {
    constructor(
        private readonly notificationService: NotificationService,
    ) { }

    async list(
        request: FastifyRequest<{ Querystring: ListNotificationsQueryDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const pagina = await this.notificationService.list(
            user.id,
            request.query.page,
        );

        reply.send({
            notifications: pagina.avisos.map((aviso) => ({
                ...aviso,
                createdAt: aviso.createdAt.toISOString(),
            })),
            unread: pagina.porLer,
            page: pagina.pagina,
            pages: pagina.paginas,
            total: pagina.total,
        });
    }

    /**
     * Só a contagem.
     *
     * A barra precisa do número a cada ecrã, e mandar-lhe trinta avisos
     * inteiros para desenhar um algarismo era pagar a lista toda de cada
     * vez que alguém muda de página.
     */
    async unread(
        request: FastifyRequest,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const porLer = await this.notificationService.countUnread(user.id);

        reply.send({ unread: porLer });
    }

    async readAll(
        request: FastifyRequest,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.notificationService.markAllRead(user.id);

        reply.code(204).send();
    }

    async read(
        request: FastifyRequest<{ Params: NotificationIdParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.notificationService.markRead(
            request.params.notificationId,
            user.id,
        );

        reply.code(204).send();
    }
}
