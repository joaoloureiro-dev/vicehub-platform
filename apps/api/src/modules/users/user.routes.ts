import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import type { UserController } from './controllers/user.controller.js';
import type { UpdateAppearanceDto } from '../../shared/appearance.js';
import { updateAppearanceSchema } from '../../shared/appearance.js';
import type {
    DeleteAccountDto,
    UpdateProfileDto,
    UsernameParamDto,
} from './dto/user.dto.js';
import {
    deleteAccountSchema,
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
     * Apagar a própria conta.
     *
     * Exige conta e mais nada: o titular vem da sessão, e por isso não
     * há forma de pedir a conta de outra pessoa. A confirmação vai no
     * corpo — um DELETE com corpo é invulgar e é o que aqui serve, já
     * que a alternativa era pôr uma password num endereço.
     */
    fastify.delete<{ Body: DeleteAccountDto }>(
        '/me',
        {
            preHandler: [fastify.authenticate],
            schema: { body: deleteAccountSchema },
        },
        controller.deleteOwnAccount.bind(controller),
    );

    /**
     * Levar os dados consigo.
     *
     * Leva um limite próprio, muito mais apertado do que o global: é a
     * leitura mais pesada que uma conta pode pedir — dez consultas, e
     * uma delas percorre a tesouraria inteira — e chamá-la em ciclo
     * seria a forma mais barata de pôr a base de dados de joelhos com
     * uma conta só.
     *
     * O mesmo limite das rotas de recuperação, e pela mesma espécie de
     * razão: são as duas rotas em que um pedido custa muito mais do que
     * aparenta.
     */
    fastify.get(
        '/me/export',
        {
            preHandler: [fastify.authenticate],
            config: {
                rateLimit: {
                    max: env.AUTH_RECOVERY_RATE_LIMIT_MAX,
                    timeWindow: env.AUTH_RECOVERY_RATE_LIMIT_WINDOW,
                },
            },
        },
        controller.exportOwnAccount.bind(controller),
    );

    /**
     * Personalização do perfil: banner e cor de destaque.
     *
     * Grátis, e sem plano nenhum pelo caminho.
     *
     * Já foi paga. A cara e o banner de quem joga não se vendem: uma
     * pessoa sem plano continua a ser uma pessoa, e um perfil cinzento ao
     * lado de um perfil com cor não diz "aquele pagou" — diz "este não
     * conta". O que se vende é gerir uma comunidade.
     */
    fastify.patch<{ Body: UpdateAppearanceDto }>(
        '/me/appearance',
        {
            preHandler: [fastify.authenticate],
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
