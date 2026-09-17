import { prisma } from '@vicehub/database';

import { buildApp } from './app.js';
import { env } from './config/env.js';
import {
    descreverProblemas,
    verificarBaseDeDados,
} from './config/startup-checks.js';

const app = buildApp();

/**
 * Espera o tempo pedido.
 *
 * O temporizador não leva `unref`: é ele que tem de segurar o processo
 * durante a drenagem. Com `unref`, bastaria o servidor deixar de ter
 * trabalho para o processo sair a meio da espera — que é precisamente
 * o que a espera existe para impedir.
 */
const esperar = (milissegundos: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, milissegundos);
    });

/**
 * Encerra o processo de forma controlada.
 *
 * Antes de terminar:
 * - anuncia na sonda de prontidão que está de saída;
 * - dá ao balanceador tempo de reparar e parar de mandar tráfego;
 * - deixa de aceitar novas ligações;
 * - aguarda o encerramento dos plugins;
 * - liberta recursos associados à aplicação.
 *
 * A ordem é o que interessa aqui. Fechar primeiro e avisar depois
 * deixa um intervalo em que o balanceador ainda manda pedidos para uma
 * porta já fechada, e quem os fez vê um erro por causa de um deploy
 * que correu bem.
 */
const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info({ signal }, 'Sinal de encerramento recebido.');

    try {
        app.comecarAEncerrar();

        if (env.SHUTDOWN_DRAIN_MS > 0) {
            app.log.info(
                { drenagemMs: env.SHUTDOWN_DRAIN_MS },
                'A sonda de prontidão já responde 503. A aguardar que o tráfego saia.',
            );

            await esperar(env.SHUTDOWN_DRAIN_MS);
        }

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