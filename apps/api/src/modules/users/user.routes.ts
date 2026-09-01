import type { FastifyPluginAsync } from 'fastify';

import type { UserController } from './controllers/user.controller.js';
import type { UpdateAppearanceDto } from '../../shared/appearance.js';
import { updateAppearanceSchema } from '../../shared/appearance.js';
import type { UpdateProfileDto, UsernameParamDto } from './dto/user.dto.js';
import {
    updateProfileSchema,
    usernameParamSchema,
} from './schemas/user.schemas.js';

interface UserRoutesOptions {
    controller: UserController;
}

/**
 * Rotas do módulo de utilizadores.
 */
const userRoutes: FastifyPluginAsync<UserRoutesOptions> = async (
    fastify,
    options,
) => {
    const { controller } = options;

    /**
     * As rotas do próprio são declaradas antes da rota com parâmetro.
     * O Fastify dá precedência à rota estática, mas manter esta ordem
     * torna a intenção evidente a quem lê.
     */
    fastify.get(
        '/me',
        { preHandler: [fastify.authenticate] },
        controller.getOwnProfile.bind(controller),
    );

    fastify.patch<{ Body: UpdateProfileDto }>(
        '/me',
        {
            preHandler: [fastify.authenticate],
            schema: { body: updateProfileSchema },
        },
        controller.updateOwnProfile.bind(controller),
    );

    /**
     * Personalização do perfil: banner e cor de destaque.
     *
     * É a primeira funcionalidade paga da plataforma. O requirePremium
     * lê o plano de quem faz o pedido — não o de uma crew —, por isso
     * corre sem parâmetros.
     */
    fastify.patch<{ Body: UpdateAppearanceDto }>(
        '/me/appearance',
        {
            preHandler: [fastify.authenticate, fastify.requirePremium('user')],
            schema: { body: updateAppearanceSchema },
        },
        controller.updateOwnAppearance.bind(controller),
    );

    /**
     * Perfil público: sem autenticação, por ser isso que o torna público.
     */
    fastify.get<{ Params: UsernameParamDto }>(
        '/:username',
        { schema: { params: usernameParamSchema } },
        controller.getPublicProfile.bind(controller),
    );
};

export default userRoutes;
