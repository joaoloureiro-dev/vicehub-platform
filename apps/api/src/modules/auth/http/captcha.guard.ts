import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';

import { captchaLigado, confirmarCaptcha } from '../../../shared/captcha.js';

/**
 * Exige o CAPTCHA antes de a rota correr.
 *
 * **PreHandler, e não uma linha no serviço**, e a diferença é o ponto:
 * corre antes de o corpo chegar ao controller, portanto antes de a conta
 * ser procurada. Um CAPTCHA conferido depois da procura já deixou um
 * guião gastar a contagem de tentativas falhadas de outra pessoa — e
 * bloquear a conta de alguém sem lhe saber a password é exatamente uma
 * das coisas que isto existe para impedir.
 *
 * Com o CAPTCHA desligado não faz nada e não fala com ninguém.
 */
export const requireCaptcha: preHandlerHookHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
): Promise<void> => {
    if (!captchaLigado()) {
        return;
    }

    const corpo = request.body as { captchaToken?: string } | undefined;

    const resultado = await confirmarCaptcha(corpo?.captchaToken, request.ip);

    if (resultado.passou) {
        return;
    }

    /**
     * O motivo fica no registo e não na resposta.
     *
     * "cartão já usado", "cartão de outro site" e "o Cloudflare não
     * respondeu" são coisas diferentes para quem administra e a mesma
     * coisa para quem está a entrar — e dizer a um guião qual delas foi
     * é dizer-lhe o que corrigir.
     */
    request.log.warn(
        { porque: resultado.porque },
        'Pedido recusado por falhar o CAPTCHA.',
    );

    await reply.status(400).send({
        statusCode: 400,
        code: 'CAPTCHA_FAILED',
        error: 'Bad Request',
        message: 'A confirmação de que não és um robô falhou. Tenta outra vez.',
    });
};
