import staticFiles from '@fastify/static';
import fp from 'fastify-plugin';
import { access, constants } from 'node:fs/promises';
import path from 'node:path';

import { env } from '../../config/env.js';

/**
 * Onde acaba a API e começa a aplicação.
 *
 * Tudo o que vive debaixo deste prefixo pertence à API e nunca é
 * respondido com a página da aplicação: um endereço de API que não
 * existe tem de dar 404 em JSON, para que um pedido mal escrito falhe
 * como erro e não como HTML que o cliente não sabe ler.
 */
const daApi = (url: string): boolean =>
    url === '/api' || url.startsWith('/api/') || url.startsWith('/api?');

/**
 * Os ficheiros que o Vite escreve com o resumo do conteúdo no nome.
 *
 * Como o nome muda sempre que o conteúdo muda, podem ser guardados para
 * sempre: um deploy novo pede nomes novos. O `index.html` não pode — o
 * nome é o mesmo entre deploys, e um guardado em cache aponta para
 * ficheiros que já não existem.
 */
const PASTA_DOS_RECURSOS = '/assets/';

const UM_ANO_EM_SEGUNDOS = 31_536_000;

/**
 * Um recurso que falta não é um endereço da aplicação.
 *
 * Sem isto, um `.js` que o deploy não copiou receberia a própria página
 * com estado 200: o browser tentava executar HTML como módulo e o erro
 * saía a falar de um `<` inesperado, muito longe do ficheiro em falta.
 * Debaixo desta pasta o nome traz o resumo do conteúdo, e portanto nunca
 * é um sítio onde alguém navega.
 */
const dosRecursos = (url: string): boolean => url.startsWith(PASTA_DOS_RECURSOS);

/**
 * Serve o `apps/web` já compilado a partir da própria API.
 *
 * Só é registado quando `WEB_DIST_PATH` está definido, e existe por uma
 * razão concreta: o refresh token vive num cookie `SameSite=strict`, e um
 * cookie posto por `api.exemplo.com` não segue num pedido feito a partir
 * de `exemplo.com`. Servir as duas coisas na mesma origem é o que faz o
 * browser tratá-las como o mesmo sítio — sem isso, a sessão morre a cada
 * F5 e nada no ecrã explica porquê.
 *
 * Quem preferir um proxy à frente a fazer o mesmo trabalho deixa a
 * variável por definir e a API volta a ser só API.
 */
const spaPlugin = fp(
    async (app) => {
        const raiz = env.WEB_DIST_PATH;

        if (raiz === undefined) {
            return;
        }

        const absoluta = path.resolve(raiz);
        const pagina = path.join(absoluta, 'index.html');

        /**
         * Um caminho errado não pode passar despercebido. Sem esta
         * verificação, a API arrancava bem e o site respondia 404 a
         * toda a gente — o pior sítio para descobrir um erro de
         * configuração é o browser de quem chega.
         */
        try {
            await access(pagina, constants.R_OK);
        } catch {
            throw new Error(
                `WEB_DIST_PATH aponta para ${absoluta}, onde não há um index.html legível. ` +
                    'Correr `npm run build --workspace=@vicehub/web` primeiro, ou não definir a variável.',
            );
        }

        await app.register(staticFiles, {
            root: absoluta,
            prefix: '/',

            /**
             * A raiz é a página. Sem isto, um pedido a `/` cai no plugin
             * estático como um pedido a uma pasta — e uma pasta sem
             * listagem responde 403. A porta de entrada da plataforma
             * dizia "proibido" a quem lá chegasse.
             */
            index: ['index.html'],

            setHeaders: (resposta, caminho) => {
                const guardavel = caminho
                    .slice(absoluta.length)
                    .replaceAll(path.sep, '/')
                    .startsWith(PASTA_DOS_RECURSOS);

                void resposta.header(
                    'cache-control',
                    guardavel
                        ? `public, max-age=${UM_ANO_EM_SEGUNDOS}, immutable`
                        : 'no-cache',
                );
            },
        });

        /**
         * A aplicação tem endereços que o servidor não conhece.
         *
         * `/crews/abc` só existe dentro do router do browser: um F5 ali
         * chega ao servidor como um pedido a um ficheiro que não existe.
         * Devolver a página deixa o router encarregar-se do resto.
         */
        app.setNotFoundHandler((pedido, resposta) => {
            const daAplicacao =
                (pedido.method === 'GET' || pedido.method === 'HEAD') &&
                !daApi(pedido.url) &&
                !dosRecursos(pedido.url);

            if (!daAplicacao) {
                void resposta.status(404).send({
                    statusCode: 404,
                    error: 'Not Found',
                    message: `Route ${pedido.method}:${pedido.url} not found`,
                });

                return;
            }

            /**
             * O nome do `index.html` não muda entre deploys. Guardado em
             * cache, continua a pedir os recursos do deploy anterior — que
             * já não existem — e a aplicação deixa de arrancar sem nada a
             * explicar porquê.
             */
            void resposta
                .header('cache-control', 'no-cache')
                .sendFile('index.html', absoluta);
        });
    },
    {
        name: 'spa-plugin',
    },
);

export default spaPlugin;
