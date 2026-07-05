import { buildApp } from './app.js';
import { env } from './config/env.js';

const app = buildApp();

/**
 * Encerra o processo de forma controlada.
 *
 * Antes de terminar:
 * - deixa de aceitar novas ligações;
 * - aguarda o encerramento dos plugins;
 * - liberta recursos associados à aplicação.
 */
const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info({ signal }, 'Sinal de encerramento recebido.');

    try {
        await app.close();
        app.log.info('API encerrada corretamente.');
        process.exit(0);
    } catch (error: unknown) {
        app.log.error(error, 'Falha ao encerrar a API corretamente.');
        process.exit(1);
    }
};

process.once('SIGINT', () => {
    void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
});

/**
 * Inicia o servidor HTTP.
 */
const startServer = async (): Promise<void> => {
    try {
        await app.listen({
            host: env.API_HOST,
            port: env.API_PORT,
        });
    } catch (error: unknown) {
        app.log.error(error, 'Falha ao iniciar a API do ViceHub.');
        process.exit(1);
    }
};

await startServer();