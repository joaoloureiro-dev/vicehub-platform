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

    /**
     * Limite das rotas de recuperação de conta.
     *
     * Muito mais apertado do que o global: pedir recuperações em massa é
     * a forma barata de usar a plataforma para encher a caixa de correio
     * de outra pessoa, e de arder a quota do fornecedor de email a
     * caminho disso.
     *
     * É configurável para poder ser levantado nos testes, que exercitam
     * o fluxo dezenas de vezes seguidas a partir do mesmo endereço.
     */
    AUTH_RECOVERY_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
    AUTH_RECOVERY_RATE_LIMIT_WINDOW: z.string().min(1).default('15 minutes'),

    /**
     * Envio de email.
     *
     * Sem SMTP_URL a plataforma arranca na mesma e os emails ficam no
     * log — o que serve para desenvolver e para os testes, e não serve
     * para utilizadores a sério: um link de recuperação escrito no log é
     * um link ao alcance de quem lê logs.
     */
    SMTP_URL: z.string().min(1).optional(),
    MAIL_FROM: z.string().min(1).default('ViceHub <no-reply@vicehub.local>'),

    /**
     * Onde vivem as páginas para onde os emails apontam.
     *
     * É daqui que sai o link de recuperação. Enquanto não houver
     * interface, aponta para o sítio onde ela há de estar.
     */
    APP_PUBLIC_URL: z.string().url().default('http://localhost:5173'),

    /**
     * Validade dos tokens enviados por email, em segundos.
     *
     * A recuperação é curta de propósito: é uma chave para entrar na
     * conta, e uma caixa de correio comprometida ontem não deve abrir
     * nada hoje. A confirmação de email não abre nada, e por isso dura
     * mais — obrigar alguém a repetir o pedido por ter demorado a ver o
     * email seria atrito sem ganho.
     */
    PASSWORD_RESET_TTL_SECONDS: z.coerce.number().int().positive().default(3_600),
    EMAIL_VERIFICATION_TTL_SECONDS: z.coerce
        .number()
        .int()
        .positive()
        .default(86_400),

    /**
     * Configuração do Stripe.
     *
     * Os três campos são opcionais e andam juntos: sem eles a plataforma
     * arranca na mesma e a compra pelo próprio responde 503. É
     * deliberado — o desenvolvimento, os testes e a integração contínua
     * não têm chaves de cobrança, e exigi-las faria a aplicação recusar
     * arrancar em todos esses sítios por causa de uma funcionalidade que
     * lá não se usa.
     *
     * A coerência entre os três é verificada depois de validar, para que
     * uma configuração meia-feita seja um erro claro em vez de uma
     * cobrança que falha em silêncio.
     */
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    /** Preço mensal recorrente do premium, criado no painel do Stripe. */
    STRIPE_PRICE_ID: z.string().min(1).optional(),

    /**
     * Para onde o Stripe devolve quem termina ou abandona a compra.
     */
    STRIPE_SUCCESS_URL: z.string().url().optional(),
    STRIPE_CANCEL_URL: z.string().url().optional(),

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

/**
 * Os campos que a cobrança pelo Stripe exige, todos ao mesmo tempo.
 */
const STRIPE_FIELDS = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_ID',
    'STRIPE_SUCCESS_URL',
    'STRIPE_CANCEL_URL',
] as const;

const stripeFieldsPresent = STRIPE_FIELDS.filter(
    (field) => env[field] !== undefined,
);

/**
 * Uma configuração de Stripe meia-feita é recusada ao arrancar.
 *
 * Ter a chave e não ter o segredo do webhook seria pior do que não ter
 * nada: a compra funcionava, o Stripe cobrava, e a plataforma nunca
 * chegava a saber que alguém tinha pago. O erro tem de aparecer aqui, e
 * não no primeiro pagamento.
 */
if (stripeFieldsPresent.length > 0 && stripeFieldsPresent.length !== STRIPE_FIELDS.length) {
    const emFalta = STRIPE_FIELDS.filter((field) => env[field] === undefined);

    throw new Error(
        `[ViceHub API] Configuração do Stripe incompleta. Em falta: ${emFalta.join(', ')}.`,
    );
}

/**
 * Se a cobrança pelo Stripe está configurada.
 *
 * Sem ela a plataforma funciona toda, incluindo a concessão manual de
 * planos; o que não existe é a compra pelo próprio.
 */
export const isStripeConfigured = stripeFieldsPresent.length === STRIPE_FIELDS.length;

/**
 * A configuração do Stripe, quando existe.
 *
 * Devolve os campos já sem `undefined`, para que quem a use não tenha de
 * voltar a verificar o que o arranque já garantiu.
 */
export const stripeConfig = isStripeConfigured
    ? Object.freeze({
        secretKey: env.STRIPE_SECRET_KEY as string,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET as string,
        priceId: env.STRIPE_PRICE_ID as string,
        successUrl: env.STRIPE_SUCCESS_URL as string,
        cancelUrl: env.STRIPE_CANCEL_URL as string,
    })
    : null;