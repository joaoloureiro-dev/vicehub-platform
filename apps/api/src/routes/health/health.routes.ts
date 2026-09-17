import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';

import type { DatabaseClient } from '@vicehub/database';

/**
 * Quanto tempo se espera pela base de dados antes de a dar por
 * indisponível.
 *
 * Uma sonda que fica pendurada é tão má como uma que mente: o
 * orquestrador não recebe resposta nenhuma e acaba por decidir por
 * timeout dele, que costuma ser muito mais longo. Dois segundos é mais
 * do que uma consulta trivial precisa e menos do que qualquer intervalo
 * de sondagem razoável.
 */
const ESPERA_MAXIMA_MS = 2_000;

/**
 * As duas perguntas que um deploy faz, e que não são a mesma.
 *
 * **Vivo** é "o processo responde". **Pronto** é "o processo consegue
 * fazer o trabalho". Separá-las não é cerimónia: uma sonda de vida que
 * falhasse por causa da base de dados faria o orquestrador **reiniciar**
 * o processo — o que não conserta a base de dados e ainda perde as
 * ligações que estavam a meio. Uma sonda de prontidão a falhar só tira
 * esta instância da rotação, que é o que se quer.
 *
 * Até aqui havia só uma rota e ela respondia `ok` sem perguntar nada a
 * ninguém. Uma instância sem base de dados — em baixo, inalcançável, ou
 * com as migrações por correr — continuava a dizer que estava bem, e o
 * balanceador continuava a mandar-lhe gente.
 */
const healthRoutes: FastifyPluginAsync = async (app) => {
    app.get('/', async () => ({
        status: 'ok',
        service: 'vicehub-api',
        timestamp: new Date().toISOString(),
    }));

    app.get('/ready', async (_request, reply) => {
        const baseDeDados = await baseDeDadosResponde(app.prisma, app.log);

        /**
         * 503 e não 500: não está avariado, está indisponível — e é
         * essa a palavra que um balanceador entende como "não me mandes
         * tráfego agora, volta a perguntar daqui a pouco".
         */
        if (!baseDeDados) {
            return reply.code(503).send({
                status: 'not_ready',
                checks: { database: 'down' },
            });
        }

        return {
            status: 'ready',
            checks: { database: 'ok' },
        };
    });
};

/**
 * Pergunta à base de dados se ela responde.
 *
 * `SELECT 1` e não uma contagem de qualquer tabela: o que se quer saber
 * é se a ligação está de pé, e uma consulta que lê dados a sério fica
 * mais lenta à medida que a plataforma cresce — uma sonda que engorda
 * com o produto acaba por ser desligada.
 *
 * Nunca lança. O que sai daqui é sim ou não, porque quem chama precisa
 * de responder ao balanceador de qualquer maneira — e o texto de um erro
 * do driver não é para ser publicado numa rota sem autenticação.
 */
const baseDeDadosResponde = async (
    prisma: DatabaseClient,
    log: FastifyBaseLogger,
): Promise<boolean> => {
    let aguardar: NodeJS.Timeout | undefined;

    try {
        const expirou = new Promise<never>((_resolve, reject) => {
            aguardar = setTimeout(
                () => reject(new Error('timeout')),
                ESPERA_MAXIMA_MS,
            );
        });

        await Promise.race([prisma.$queryRaw`SELECT 1`, expirou]);

        return true;
    } catch (erro: unknown) {
        log.warn({ err: erro }, 'A base de dados não respondeu à sonda.');

        return false;
    } finally {
        /**
         * Sem isto, cada sondagem deixava um temporizador de dois
         * segundos vivo — e uma sonda corre de dez em dez segundos para
         * sempre.
         */
        if (aguardar) {
            clearTimeout(aguardar);
        }
    }
};

export default healthRoutes;
