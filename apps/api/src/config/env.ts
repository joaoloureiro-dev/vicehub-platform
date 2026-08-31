import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Carrega o .env localizado na raiz do monorepo.
 */
dotenv.config({
    path: path.resolve(__dirname, '../../../../.env'),
    quiet: true,
});


import { z } from 'zod';

/**
 * Converte uma string de configuração num valor booleano estrito.
 *
 * Não usamos z.coerce.boolean(), porque qualquer string não vazia,
 * incluindo "false", poderia ser interpretada como verdadeira.
 */
const booleanStringSchema = z
    .enum(['true', 'false'])
    .transform((value) => value === 'true');

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    API_HOST: z.string().min(1).default('0.0.0.0'),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    API_LOG_LEVEL: z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
        .default('info'),

    DATABASE_URL: z.string().min(1),

    JWT_ACCESS_SECRET: z.string().min(64),
    JWT_REFRESH_SECRET: z.string().min(64),

    JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_TOKEN_TTL_SECONDS: z.coerce
        .number()
        .int()
        .positive()
        .default(2_592_000),

    AUTH_COOKIE_NAME: z.string().min(1).default('vicehub_refresh_token'),
    AUTH_COOKIE_SECURE: booleanStringSchema.default(false),

    /**
     * Proteção contra brute force no login.
     *
     * Após este número de tentativas falhadas consecutivas, a conta fica
     * bloqueada durante o período configurado. Um login bem sucedido
     * repõe o contador.
     */
    AUTH_MAX_FAILED_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
    AUTH_LOCKOUT_DURATION_SECONDS: z.coerce.number().int().positive().default(900),

    CORS_ALLOWED_ORIGINS: z
        .string()
        .min(1)
        .transform((value) =>
            value
                .split(',')
                .map((origin) => origin.trim())
                .filter((origin) => origin.length > 0),
        ),
});

const parsedEnvironment = envSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
    console.error(
        '[ViceHub API] Configuração de ambiente inválida:',
        parsedEnvironment.error.flatten().fieldErrors,
    );

    throw new Error('A configuração de ambiente da API é inválida.');
}

/**
 * Única fonte de acesso às variáveis de ambiente da API.
 *
 * Os restantes módulos não devem consultar process.env diretamente.
 */
export const env = Object.freeze(parsedEnvironment.data);

export type Environment = typeof env;