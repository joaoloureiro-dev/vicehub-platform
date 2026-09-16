import type { FastifyPluginAsync } from 'fastify';

import type { BillingController } from './controllers/billing.controller.js';
import type { OpenPortalDto, StartCheckoutDto } from './dto/billing.dto.js';
import {
    openPortalSchema,
    startCheckoutSchema,
} from './schemas/billing.schemas.js';

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
     * O que se pode comprar, e a que preço.
     *
     * Sem sessão: quem ainda não tem conta é precisamente quem precisa
     * de ver o preço antes de a criar. Não expõe nada de ninguém — é o
     * catálogo, o mesmo para toda a gente.
     */
    fastify.get('/plans', controller.listPlans.bind(controller));

    /**
     * Comprar o plano para si próprio, para uma crew ou para um servidor.
     *
     * Exige conta, e mais nada **a este nível**: o titular vem no corpo, e
     * o guard de autorização lê o âmbito dos parâmetros da rota — não o
     * saberia encontrar. Quem pode comprometer cada titular é verificado
     * no serviço, que recusa com 403 tal como este guard recusaria.
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
     * Gerir o que já se comprou: cancelar, trocar o cartão, tirar as
     * faturas.
     *
     * A autorização é a mesma da compra, e pelo mesmo caminho: exige
     * conta a este nível, e quem pode decidir sobre o titular é
     * verificado no serviço, porque o titular vem no corpo e o guard lê
     * dos parâmetros da rota.
     *
     * Ter a mesma regra dos dois lados não é uma comodidade — é a regra.
     * Se cancelar fosse mais apertado do que comprar, uma comunidade
     * ficava a pagar sem ninguém que lhe pudesse pôr fim.
     */
    fastify.post<{ Body: OpenPortalDto }>(
        '/portal',
        {
            preHandler: [fastify.authenticate],
            schema: { body: openPortalSchema },
        },
        controller.openPortal.bind(controller),
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
