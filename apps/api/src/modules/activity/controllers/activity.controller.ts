import type { FastifyReply, FastifyRequest } from 'fastify';

import { requireAuthContext } from '../../auth/http/auth-context.guard.js';
import type { ActivityService } from '../services/activity.service.js';

export class ActivityController {
    constructor(private readonly activityService: ActivityService) { }

    async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const { user } = requireAuthContext(request);

        const itens = await this.activityService.listForUser(user.id);

        reply.send(
            itens.map((item) => ({ ...item, at: item.at.toISOString() })),
        );
    }
}
