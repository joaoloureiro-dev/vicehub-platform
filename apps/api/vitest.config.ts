import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        /**
         * A configuração de ambiente da API é validada no arranque, por isso
         * os testes precisam de valores válidos antes de importar qualquer
         * módulo. Estes valores são de teste e nunca tocam numa base de dados
         * real: a suite não abre ligações.
         */
        env: {
            NODE_ENV: 'test',
            API_LOG_LEVEL: 'silent',
            DATABASE_URL: 'postgresql://vicehub:vicehub@127.0.0.1:5432/vicehub_test',
            JWT_ACCESS_SECRET:
                'test-access-secret-com-mais-de-sessenta-e-quatro-caracteres-0123456789',
            JWT_REFRESH_SECRET:
                'test-refresh-secret-com-mais-de-sessenta-e-quatro-caracteres-0123456789',
            CORS_ALLOWED_ORIGINS: 'https://app.vicehub.com',
            AUTH_COOKIE_SECURE: 'false',
        },

        include: ['tests/**/*.test.ts'],

        /**
         * Argon2 é propositadamente lento. O tempo por omissão do Vitest
         * não chega para os testes que fazem hash real.
         */
        testTimeout: 30_000,

        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.d.ts', 'src/server.ts'],
        },
    },
});
