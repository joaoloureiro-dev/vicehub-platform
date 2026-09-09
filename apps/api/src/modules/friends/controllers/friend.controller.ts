import type { FastifyReply, FastifyRequest } from 'fastify';

import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import type { FriendParamDto } from '../dto/friend.dto.js';
import type { FriendService } from '../services/friend.service.js';
import type { Friend } from '../types/friend.types.js';

export class FriendController {
    constructor(private readonly friendService: FriendService) { }

    async request(
        request: FastifyRequest<{ Params: FriendParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        const resultado = await this.friendService.request(
            user.id,
            request.params.userId,
        );

        /**
         * 201 quando nasce um pedido, 200 quando o que aconteceu foi
         * aceitar o que já lá estava. Quem chama fica a saber qual dos
         * dois foi sem ter de perguntar outra vez.
         */
        reply.code(resultado === 'requested' ? 201 : 200).send({ resultado });
    }

    async accept(
        request: FastifyRequest<{ Params: FriendParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.friendService.accept(user.id, request.params.userId);

        reply.status(204).send();
    }

    async remove(
        request: FastifyRequest<{ Params: FriendParamDto }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        await this.friendService.remove(user.id, request.params.userId);

        reply.status(204).send();
    }

    async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const { user } = requireAuthContext(request);

        reply.send(
            (await this.friendService.listFriends(user.id)).map((amigo) =>
                this.toDto(amigo),
            ),
        );
    }

    async listRequests(
        request: FastifyRequest,
        reply: FastifyReply,
    ): Promise<void> {
        const { user } = requireAuthContext(request);

        reply.send(
            (await this.friendService.listRequests(user.id)).map((pedido) => ({
                ...this.toDto(pedido),
                direction: pedido.direction,
            })),
        );
    }

    private toDto(amigo: Friend) {
        return { ...amigo, since: amigo.since.toISOString() };
    }
}
