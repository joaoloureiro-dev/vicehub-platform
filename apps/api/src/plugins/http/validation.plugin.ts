import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { ZodType } from 'zod';

/**
 * Liga os schemas Zod ao ciclo de validação do Fastify.
 *
 * Com este compiler, uma rota pode declarar:
 *
 * schema: { body: registerSchema }
 *
 * e o corpo do pedido passa a ser validado em runtime antes de
 * chegar ao handler. O Fastify substitui request.body pelo resultado
 * do parse, pelo que os valores transformados pelo schema, como o
 * trim do email, ficam disponíveis no controller.
 *
 * Quando a validação falha devolvemos o próprio ZodError. O Fastify
 * reconhece-o como erro de validação, marca-o com estado 400 e
 * entrega-o ao error handler global, que o formata.
 */
const validationPlugin: FastifyPluginAsync = async (fastify) => {
    fastify.setValidatorCompiler<ZodType>(({ schema }) => {
        return (data): { value: unknown } | { error: Error } => {
            const result = schema.safeParse(data);

            if (!result.success) {
                return { error: result.error };
            }

            return { value: result.data };
        };
    });
};

export default fp(validationPlugin, {
    name: 'validation-plugin',
});
