import fp from 'fastify-plugin';

import { prisma } from '@vicehub/database';

/**
 * Plugin responsável pela ligação Prisma.
 *
 * Usa a instância única criada no package database.
 */
const prismaPlugin = fp(
    async (fastify) => {
        fastify.decorate('prisma', prisma);

        /**
         * Fecha ligação Prisma quando a API termina.
         */
        fastify.addHook('onClose', async () => {
            await prisma.$disconnect();
        });
    },
    {
        name: 'prisma-plugin',
    },
);

export default prismaPlugin;
