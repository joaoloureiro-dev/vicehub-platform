import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

import {
    ENDERECO_PUBLICO,
    mapaDoSitio,
    robots,
} from './src/lib/sitio-publico.js';

/**
 * O endereço público, para as etiquetas de partilha e para o mapa.
 *
 * Um cartão de link precisa de endereços absolutos, e a compilação da
 * interface é o único sítio onde o domínio pode entrar num ficheiro
 * estático. Quem compila diz qual é; sem ninguém dizer, fica o do
 * `sitio-publico.ts`.
 */
const endereco = (): string =>
    process.env['VITE_PUBLIC_URL']
    ?? process.env['APP_PUBLIC_URL']
    ?? ENDERECO_PUBLICO;

/**
 * Escreve o `robots.txt` e o `sitemap.xml`, e põe o domínio no HTML.
 *
 * Os dois ficheiros não estão no `public/` porque não são estáticos:
 * nomeiam o domínio, e um domínio escrito à mão num ficheiro é um
 * domínio que fica para trás quando ele muda.
 */
const sitioPublico = (): Plugin => ({
    name: 'vicehub-sitio-publico',

    transformIndexHtml: {
        order: 'pre',
        handler: (html) => html.replaceAll('%ENDERECO%', endereco().replace(/\/+$/u, '')),
    },

    generateBundle() {
        this.emitFile({
            type: 'asset',
            fileName: 'sitemap.xml',
            source: mapaDoSitio(endereco()),
        });

        this.emitFile({
            type: 'asset',
            fileName: 'robots.txt',
            source: robots(endereco()),
        });
    },
});

/**
 * O servidor de desenvolvimento encaminha `/api` para a API.
 *
 * Não é conveniência: o refresh token vive num cookie HttpOnly com
 * `SameSite`, e um cookie posto por `localhost:3000` não é enviado num
 * pedido feito a partir de `localhost:5173`. Servir as duas coisas na
 * mesma origem faz o browser tratá-las como o mesmo sítio, que é o que
 * acontece em produção.
 */
export default defineConfig({
    plugins: [react(), sitioPublico()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: process.env['VITE_API_TARGET'] ?? 'http://localhost:3000',
                changeOrigin: false,
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
});
