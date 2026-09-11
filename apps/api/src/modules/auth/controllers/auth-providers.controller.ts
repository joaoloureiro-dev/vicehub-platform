import type { FastifyReply, FastifyRequest } from 'fastify';

import { isDiscordConfigured, isGoogleConfigured } from '../../../config/env.js';

/**
 * GET /auth/providers — que formas de entrar existem aqui.
 *
 * Pública e sem sessão: é lida pelo ecrã de entrada, antes de haver
 * conta nenhuma. Existe para que cada botão só apareça onde funciona —
 * um botão que leva a um erro é pior do que botão nenhum.
 *
 * Não diz mais nada do que se está ou não configurado. Identificadores
 * de cliente e endereços de retorno não fazem falta ao browser, e o que
 * não se responde não se expõe.
 */
export class AuthProvidersController {
    async list(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
        reply.send({
            discord: isDiscordConfigured,
            google: isGoogleConfigured,
        });
    }
}
