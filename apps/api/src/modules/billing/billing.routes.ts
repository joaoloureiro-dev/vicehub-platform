import type { FastifyPluginAsync } from 'fastify';

import type { BillingController } from './controllers/billing.controller.js';
import type { StartCheckoutDto } from './dto/billing.dto.js';
import { startCheckoutSchema } from './schemas/billing.schemas.js';

interface BillingRoutesOptions {
    controller: BillingController;
}

/**
 * Rotas da cobrança.
 */
const billingRoutes: FastifyPluginAsync<BillingRoutesOptions> = async (
    fastify,
    options,
) => {
    const { controller } = options;

    /**
     * Comprar o plano para si próprio, para uma crew ou para um servidor.
     *
     * Exige conta, e mais nada a este nível: quem pode comprometer uma
     * crew a uma cobrança recorrente é decidido no serviço, que sabe
     * qual é o titular do pedido.
     */
    fastify.post<{ Body: StartCheckoutDto }>(
        '/checkout',
        {
            preHandler: [fastify.authenticate],
            schema: { body: startCheckoutSchema },
        },
        controller.startCheckout.bind(controller),
    );

    /**
     * O webhook vive no seu próprio âmbito por causa do corpo em bruto.
     *
     * A assinatura do Stripe cobre os bytes tal como foram enviados, e
     * voltar a serializar o objeto — reordenar chaves, mudar espaços —
     * invalidaria a verificação. Por isso este âmbito lê o corpo como
     * Buffer.
     *
     * O interpretador fica **encapsulado aqui**: registá-lo mais acima
     * faria todas as outras rotas da aplicação deixarem de receber JSON
     * já interpretado, o que partiria a API inteira para resolver o
     * problema de uma rota.
     */
    await fastify.register(async (webhookScope) => {
        webhookScope.addContentTypeParser(
            'application/json',
            { parseAs: 'buffer' },
            (_request, body, done) => {
                done(null, body);
            },
        );

        /**
         * Pública por natureza: quem a chama é o Stripe, que não tem
         * conta nesta plataforma. O que a protege é a assinatura,
         * verificada antes de qualquer leitura do conteúdo — sem ela,
         * esta rota seria uma forma pública de conceder planos.
         */
        webhookScope.post('/webhook', controller.handleWebhook.bind(controller));
    });
};

export default billingRoutes;
