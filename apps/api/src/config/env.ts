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
     * A pasta com o `apps/web` já compilado, para a API a servir.
     *
     * Opcional, e é opcional de propósito: em desenvolvimento o Vite
     * serve a aplicação, e quem tiver um proxy à frente prefere que seja
     * ele a servi-la. Definida, a API passa a servir a interface na sua
     * própria origem — que é o que o cookie do refresh token exige, por
     * ser `SameSite=strict`. Duas origens diferentes e o cookie nunca
     * chega à API: a sessão morre a cada F5 sem nada a indicar porquê.
     */
    WEB_DIST_PATH: z.string().min(1).optional(),

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

    /**
     * Um preço do Stripe por cada plano que se vende.
     *
     * São independentes uns dos outros e todos opcionais: **um plano
     * está à venda aqui se, e só se, tiver preço configurado**. É assim
     * que um escalão novo abre — pondo o preço — e não com um deploy.
     *
     * Antes havia um preço só, e o checkout vendia esse fosse qual
     * fosse o plano pedido. Um servidor que comprasse o escalão sem
     * limite pagava o preço de uma crew e ficava com o plano de uma
     * crew, que lhe dava três lugares. Os preços passaram a ser um por
     * plano precisamente para que isso deixe de ser possível de
     * escrever.
     *
     * A cobrança exige pelo menos um: chaves sem preço nenhum são um
     * botão de pagar que não sabe cobrar coisa nenhuma.
     */
    STRIPE_PRICE_PREMIUM: z.string().min(1).optional(),
    STRIPE_PRICE_SERVER_BASE: z.string().min(1).optional(),
    STRIPE_PRICE_SERVER_PLUS: z.string().min(1).optional(),
    STRIPE_PRICE_SERVER_UNLIMITED: z.string().min(1).optional(),

    /**
     * Para onde o Stripe devolve quem termina ou abandona a compra.
     */
    STRIPE_SUCCESS_URL: z.string().url().optional(),
    STRIPE_CANCEL_URL: z.string().url().optional(),

    /**
     * Entrar com Discord.
     *
     * Os três andam juntos e são opcionais como os do Stripe, e pela
     * mesma razão: o desenvolvimento, os testes e a integração contínua
     * não têm uma aplicação registada no Discord, e exigi-la faria a
     * plataforma recusar arrancar em todos esses sítios por causa de uma
     * forma de entrar que lá não se usa.
     *
     * O endereço de retorno tem de ser exatamente o que está registado
     * no portal do Discord — é ele que compara, e uma diferença de uma
     * barra é uma recusa sem explicação.
     */
    DISCORD_CLIENT_ID: z.string().min(1).optional(),
    DISCORD_CLIENT_SECRET: z.string().min(1).optional(),
    DISCORD_REDIRECT_URI: z.string().url().optional(),

    /**
     * Entrar com Google, nos mesmos termos do Discord.
     *
     * Os três vêm da consola da Google e o de retorno tem de estar lá
     * registado tal e qual — a Google é ainda mais literal do que o
     * Discord a compará-lo, e uma barra a mais devolve `redirect_uri_mismatch`
     * antes de a pessoa chegar a ver o ecrã de autorização.
     */
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    GOOGLE_REDIRECT_URI: z.string().url().optional(),

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

/**
 * Os nomes de todas as variáveis que a API lê.
 *
 * Existe para o `.env.example` poder ser confrontado com a verdade em
 * vez de acreditarem nele. Um exemplo que não menciona uma variável é um
 * exemplo que envelheceu — e ninguém dá por isso enquanto não faltar
 * qualquer coisa em produção, que é o pior sítio para dar por ela.
 */
export const NOMES_DAS_VARIAVEIS: readonly string[] = Object.freeze(
    Object.keys(envSchema.shape),
);

const parsedEnvironment = envSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
    console.error(
        '[ViceHub API] Configuração de ambiente inválida:',
        parsedEnvironment.error.flatten().fieldErrors,
    );

    throw new Error('A configuração de ambiente da API é inválida.');
}

/**
 * O que é aceitável em desenvolvimento e inaceitável em produção.
 *
 * Estas duas são perigosas precisamente por terem um valor por omissão
 * que funciona: nada falha, nada avisa, e o estrago só aparece quando
 * alguém a sério tenta usar a plataforma. Mais vale recusar arrancar.
 *
 * Exportada para ser testada sem mexer no ambiente do processo.
 */
export const problemasDeProducao = (
    valores: Pick<
        z.infer<typeof envSchema>,
        'NODE_ENV' | 'AUTH_COOKIE_SECURE' | 'APP_PUBLIC_URL' | 'SMTP_URL'
    >,
): string[] => {
    if (valores.NODE_ENV !== 'production') {
        return [];
    }

    const problemas: string[] = [];

    /**
     * Sem a marca `Secure`, o cookie do refresh token viaja também em
     * ligações não cifradas. É o token que mantém a sessão aberta.
     */
    if (!valores.AUTH_COOKIE_SECURE) {
        problemas.push(
            'AUTH_COOKIE_SECURE tem de ser true em produção: sem isso o cookie da sessão não é marcado como Secure.',
        );
    }

    /**
     * O endereço que segue nos emails de recuperação sai daqui. Deixá-lo
     * no valor por omissão manda toda a gente para o localhost de quem
     * fez o deploy — e o pedido parece ter corrido bem.
     */
    const publico = new URL(valores.APP_PUBLIC_URL).hostname;

    if (publico === 'localhost' || publico === '127.0.0.1') {
        problemas.push(
            `APP_PUBLIC_URL aponta para ${publico} em produção: os links de recuperação enviados por email não levariam a lado nenhum.`,
        );
    }

    /**
     * Sem SMTP_URL os emails não são enviados: são escritos no log.
     *
     * Em desenvolvimento isso é uma comodidade. Em produção é duas
     * coisas más ao mesmo tempo. A primeira é que ninguém consegue
     * confirmar a conta nem recuperar a palavra-passe, e a plataforma
     * não dá sinal disso — o pedido responde na mesma que sim. A
     * segunda é pior: um link de recuperação é uma chave para entrar
     * numa conta, e escrevê-lo no log deixa essa chave em texto simples
     * ao alcance de toda a gente que leia logs.
     *
     * Por isso não é aviso, é recusa. Um aviso no arranque perde-se
     * entre as outras linhas, e quando se der por ela já há contas
     * dependentes de emails que nunca saíram.
     */
    if (valores.SMTP_URL === undefined) {
        problemas.push(
            'SMTP_URL não está definida em produção: os emails de confirmação e de recuperação ficariam escritos no log em vez de serem enviados, e um link de recuperação no log é uma chave para entrar numa conta.',
        );
    }

    return problemas;
};

const problemas = problemasDeProducao(parsedEnvironment.data);

if (problemas.length > 0) {
    console.error(
        '[ViceHub API] Configuração inaceitável em produção:\n' +
            problemas.map((problema) => `  - ${problema}`).join('\n'),
    );

    throw new Error('A configuração de ambiente não serve para produção.');
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
    'STRIPE_SUCCESS_URL',
    'STRIPE_CANCEL_URL',
] as const;

/**
 * O preço de cada plano, pela chave com que ele é conhecido no
 * catálogo.
 *
 * O catálogo vive no package de dados e não conhece o ambiente; é aqui
 * que os dois se encontram, e é por isso que esta lista tem de ser lida
 * ao lado dele quando um plano novo aparecer.
 */
const STRIPE_PRICE_FIELDS = {
    premium: 'STRIPE_PRICE_PREMIUM',
    server_base: 'STRIPE_PRICE_SERVER_BASE',
    server_plus: 'STRIPE_PRICE_SERVER_PLUS',
    server_unlimited: 'STRIPE_PRICE_SERVER_UNLIMITED',
} as const;

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
 * Os preços configurados, por chave de plano.
 *
 * Um plano sem preço aqui não se vende: não aparece na lista de preços
 * e o checkout recusa-o. É o que permite abrir os escalões de servidor
 * um a um, sem tocar em código.
 */
export const stripePriceIds: Readonly<Record<string, string>> = Object.freeze(
    Object.fromEntries(
        Object.entries(STRIPE_PRICE_FIELDS)
            .map(([plano, campo]) => [plano, env[campo]] as const)
            .filter((entrada): entrada is readonly [string, string] =>
                entrada[1] !== undefined,
            ),
    ),
);

/**
 * Chaves sem preço nenhum são recusadas ao arrancar.
 *
 * É a mesma regra da meia configuração: um botão de pagar que não sabe
 * cobrar coisa nenhuma falha na primeira compra, e não no arranque —
 * que é o único sítio onde alguém está a olhar.
 */
if (
    stripeFieldsPresent.length === STRIPE_FIELDS.length &&
    Object.keys(stripePriceIds).length === 0
) {
    throw new Error(
        `[ViceHub API] Cobrança configurada sem preço nenhum. Define pelo menos um de: ${Object.values(
            STRIPE_PRICE_FIELDS,
        ).join(', ')}.`,
    );
}

/**
 * Um preço sem chaves também não serve.
 *
 * Ao contrário, quem pusesse os preços e se esquecesse das chaves via a
 * lista de preços vazia e a compra fechada, sem nada a dizer porquê.
 */
const precosPresentes = Object.keys(stripePriceIds).length > 0;

if (precosPresentes && stripeFieldsPresent.length !== STRIPE_FIELDS.length) {
    const emFalta = STRIPE_FIELDS.filter((field) => env[field] === undefined);

    throw new Error(
        `[ViceHub API] Há preços do Stripe configurados mas falta o resto. Em falta: ${emFalta.join(', ')}.`,
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
 * A configuração de uma forma de entrar por outro sítio, quando existe.
 *
 * Lê os três campos de um fornecedor e devolve-os já sem `undefined`,
 * ou `null` se nenhum deles estiver posto.
 *
 * **Meia configuração é recusada ao arrancar.** Ter o identificador sem
 * o segredo daria um botão que leva ao fornecedor e volta com um erro
 * que ninguém sabe ler; mais vale não arrancar. O erro tem de aparecer
 * aqui e não na primeira entrada de alguém.
 */
const lerFederado = (fornecedor: string, prefixo: 'DISCORD' | 'GOOGLE') => {
    const campos = [
        `${prefixo}_CLIENT_ID`,
        `${prefixo}_CLIENT_SECRET`,
        `${prefixo}_REDIRECT_URI`,
    ] as const;

    const postos = campos.filter((campo) => env[campo] !== undefined);

    if (postos.length > 0 && postos.length !== campos.length) {
        const emFalta = campos.filter((campo) => env[campo] === undefined);

        throw new Error(
            `[ViceHub API] Configuração do ${fornecedor} incompleta. Em falta: ${emFalta.join(', ')}.`,
        );
    }

    if (postos.length !== campos.length) {
        return null;
    }

    return Object.freeze({
        clientId: env[campos[0]] as string,
        clientSecret: env[campos[1]] as string,
        redirectUri: env[campos[2]] as string,
    });
};

/**
 * A configuração do Discord, quando existe.
 */
export const discordConfig = lerFederado('Discord', 'DISCORD');

/**
 * Se entrar com Discord está configurado.
 */
export const isDiscordConfigured = discordConfig !== null;

/**
 * A configuração da Google, quando existe.
 */
export const googleConfig = lerFederado('Google', 'GOOGLE');

/**
 * Se entrar com Google está configurado.
 *
 * Um fornecedor não depende do outro: dá para ter só o Discord, só a
 * Google, os dois ou nenhum, e o ecrã de entrada mostra o que houver.
 */
export const isGoogleConfigured = googleConfig !== null;

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
        successUrl: env.STRIPE_SUCCESS_URL as string,
        cancelUrl: env.STRIPE_CANCEL_URL as string,
    })
    : null;