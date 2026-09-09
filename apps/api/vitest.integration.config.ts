import { defineConfig } from 'vitest/config';

/**
 * Configuração dos testes de integração.
 *
 * Ao contrário da suite unitária, estes correm contra PostgreSQL a
 * sério. Existem porque há garantias que só a base de dados pode dar —
 * duas aprovações simultâneas do mesmo movimento, ou duas saídas que
 * juntas excedem o saldo, não são verificáveis com duplos em memória.
 *
 * O DATABASE_URL vem do ambiente e não daqui: apontar para uma base de
 * dados errada apagaria dados de alguém.
 */
export default defineConfig({
    test: {
        env: {
            NODE_ENV: 'test',
            API_LOG_LEVEL: 'silent',
            JWT_ACCESS_SECRET:
                'test-access-secret-com-mais-de-sessenta-e-quatro-caracteres-0123456789',
            JWT_REFRESH_SECRET:
                'test-refresh-secret-com-mais-de-sessenta-e-quatro-caracteres-0123456789',
            CORS_ALLOWED_ORIGINS: 'https://app.vicehub.com',
            AUTH_COOKIE_SECURE: 'false',

            /**
             * As rotas de recuperação têm um limite apertado em
             * produção, e estes testes exercitam-nas dezenas de vezes a
             * partir do mesmo endereço. O limite é levantado aqui para
             * que a suite meça o fluxo e não o limitador; que o limite
             * existe e é mais apertado do que o global fica fixado no
             * teste de ligação das rotas.
             */
            AUTH_RECOVERY_RATE_LIMIT_MAX: '1000',

            /**
             * Entrar com Discord precisa de estar configurado para as
             * rotas existirem. As chamadas ao Discord são substituídas
             * dentro do teste: o que se quer verificar é a decisão sobre
             * a conta, e não a rede.
             */
            DISCORD_CLIENT_ID: 'client-de-teste',
            DISCORD_CLIENT_SECRET: 'segredo-de-teste',
            DISCORD_REDIRECT_URI: 'http://localhost:3000/api/v1/auth/discord/callback',
        },

        include: ['tests/integration/**/*.test.ts'],

        /**
         * Argon2 é propositadamente lento, e cada teste regista contas
         * reais.
         */
        testTimeout: 60_000,

        /**
         * Um ficheiro de cada vez: os testes partilham a mesma base de
         * dados, e correr em paralelo faria uns verem os dados dos outros.
         */
        fileParallelism: false,
    },
});
