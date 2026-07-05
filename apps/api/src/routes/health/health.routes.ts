import type { FastifyPluginAsync } from 'fastify';

const healthRoutes: FastifyPluginAsync = async (app) => {
    app.get('/', async () => {
        return {
            status: 'ok',
            service: 'vicehub-api',
            timestamp: new Date().toISOString(),
        };
    });
};

export default healthRoutes;