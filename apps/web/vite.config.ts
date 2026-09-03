import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
    plugins: [react()],
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
