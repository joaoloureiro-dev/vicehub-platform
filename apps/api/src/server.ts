import { prisma } from '@vicehub/database';

import { buildApp } from './app.js';
import { env } from './config/env.js';
import {
    descreverProblemas,
    verificarBaseDeDados,
} from './config/startup-checks.js';

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
    /**
     * A base de dados é confrontada antes de a porta abrir.
     *
     * Aberta a porta, o problema deixa de ser um erro de arranque e
     * passa a ser um 500 no primeiro registo — que é onde ele estava
     * antes, e onde ninguém o conseguia ler.
     *
     * Falhar aqui é a mesma escolha que a configuração de produção já
     * faz: mais vale não arrancar do que arrancar meia.
     */
    try {
        const problemas = await verificarBaseDeDados(prisma);

        if (problemas.length > 0) {
            /**
             * `console.error` e não `app.log.fatal`, e não é descuido.
             *
             * O logger escreve de forma assíncrona — em desenvolvimento
             * até noutra thread, por causa do pino-pretty. Um
             * `process.exit` logo a seguir mata o processo antes de a
             * linha sair, e a mensagem nunca chega ao terminal. Foi
             * assim que a mensagem original se perdeu, e repetir o erro
             * dentro da própria correção seria irónico de mais.
             *
             * Isto é uma mensagem de arranque para uma pessoa a olhar
             * para um terminal, não registo de aplicação: stderr
             * síncrono é o sítio certo para ela.
             */
            console.error(descreverProblemas(problemas));
            process.exit(1);
        }
    } catch (error: unknown) {
        /**
         * Não conseguir sequer perguntar é o caso mais comum de todos —
         * um DATABASE_URL errado, ou a base de dados por arrancar — e
         * merece ser dito com essas palavras em vez de um erro de driver.
         */
        console.error(
            'Não foi possível falar com a base de dados. Confirma o DATABASE_URL no .env e que o PostgreSQL está a correr.\n',
            error,
        );

        process.exit(1);
    }

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