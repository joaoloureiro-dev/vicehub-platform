import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';

import {
    AuthError,
    type AuthErrorCode,
} from '../../modules/auth/errors/auth.errors.js';
import { AuthorizationError } from '../../modules/authorization/errors/authorization.errors.js';
import { UserError } from '../../modules/users/errors/user.errors.js';
import {
    AffiliationError,
    type AffiliationErrorCode,
} from '../../modules/affiliations/errors/affiliation.errors.js';
import {
    FriendError,
    type FriendErrorCode,
} from '../../modules/friends/errors/friend.errors.js';
import {
    IngestError,
    type IngestErrorCode,
} from '../../modules/ingest/errors/ingest.errors.js';
import {
    CrewError,
    type CrewErrorCode,
} from '../../modules/crews/errors/crew.errors.js';
import {
    ServerError,
    type ServerErrorCode,
} from '../../modules/servers/errors/server.errors.js';
import {
    BillingError,
    type BillingErrorCode,
} from '../../modules/billing/errors/billing.errors.js';
import {
    EventError,
    type EventErrorCode,
} from '../../modules/events/errors/event.errors.js';
import {
    TreasuryError,
    type TreasuryErrorCode,
} from '../../modules/treasury/errors/treasury.errors.js';
import {
    SubscriptionError,
    type SubscriptionErrorCode,
} from '../../modules/subscriptions/errors/subscription.errors.js';

/**
 * Estado HTTP associado a cada erro de domínio da autenticação.
 *
 * Manter o mapa exaustivo garante que um código novo em AuthErrorCode
 * obriga a decidir o estado HTTP correspondente em vez de cair
 * silenciosamente em 500.
 */
const authErrorStatusCodes: Record<AuthErrorCode, number> = {
    /**
     * 423 distingue o bloqueio da conta do 429 devolvido pelo limitador
     * global de pedidos, que é por endereço IP.
     */
    ACCOUNT_LOCKED: 423,
    EMAIL_ALREADY_EXISTS: 409,
    USERNAME_ALREADY_EXISTS: 409,
    INVALID_CREDENTIALS: 401,
    INVALID_ACCESS_TOKEN: 401,
    INVALID_REFRESH_TOKEN: 401,
    REFRESH_TOKEN_REUSED: 401,
    SESSION_NOT_FOUND: 404,
    USER_NOT_FOUND: 404,

    /**
     * 400: o link não confere. Um inexistente, um já usado e um expirado
     * dão todos o mesmo — separá-los diria a quem tenta às cegas qual
     * dos casos acertou.
     */
    INVALID_ACCOUNT_TOKEN: 400,
    /** Já está confirmado: não é erro de quem pede, é estado. */
    EMAIL_ALREADY_VERIFIED: 409,
    FEDERATED_NOT_CONFIGURED: 503,
    /** Não está avariado do nosso lado: o fornecedor é que não respondeu. */
    FEDERATED_UNAVAILABLE: 502,
    FEDERATED_EXCHANGE_FAILED: 502,
    /**
     * 400 e não 403: o pedido chegou mal formado — sem `state`, ou com
     * um que não saiu daqui. Não há aqui ninguém a quem recusar acesso.
     */
    FEDERATED_STATE_MISMATCH: 400,
    FEDERATED_EMAIL_UNUSABLE: 409,
};

/**
 * 402 diz que falta o pagamento, e não que faltam permissões. Um
 * utilizador com o cargo certo mas sem plano recebe uma resposta que
 * distingue o que tem de fazer para prosseguir.
 */
const subscriptionErrorStatusCodes: Record<SubscriptionErrorCode, number> = {
    SUBSCRIPTION_REQUIRED: 402,
    INVALID_SUBSCRIPTION_OWNER: 500,
    SUBSCRIPTION_OWNER_NOT_FOUND: 404,
    SUBSCRIPTION_NOT_FOUND: 404,
    SUBSCRIPTION_ALREADY_CANCELED: 409,
    SUBSCRIPTION_ALREADY_ENDED: 409,
    /**
     * 400 e não 409: pedir duração para um plano que não termina é um
     * pedido mal formado, e não um conflito com o estado atual.
     */
    LIFETIME_HAS_NO_DURATION: 400,
    /** O titular já tem o que se estava a tentar dar-lhe. */
    ALREADY_LIFETIME: 409,
    LIFETIME_CANNOT_BE_CANCELED: 409,
};

/**
 * Estatuto HTTP de cada erro das amizades.
 */
const friendErrorStatusCodes: Record<FriendErrorCode, number> = {
    USER_NOT_FOUND: 404,
    /**
     * 409 e não 400: o pedido está bem escrito, e o que o impede é o
     * estado — que quem pede e quem recebe são a mesma pessoa.
     */
    CANNOT_FRIEND_SELF: 409,
    ALREADY_FRIENDS: 409,
    ALREADY_REQUESTED: 409,
    FRIENDSHIP_NOT_FOUND: 404,
    FRIENDSHIP_NOT_PENDING: 409,
    CANNOT_ACCEPT_OWN_REQUEST: 409,
};

const crewErrorStatusCodes: Record<CrewErrorCode, number> = {
    CREW_NOT_FOUND: 404,
    CREW_NAME_TAKEN: 409,
    CREW_TAG_TAKEN: 409,
    MEMBERSHIP_NOT_FOUND: 404,
    ALREADY_MEMBER: 409,
    NOT_A_MEMBER: 404,
    MEMBERSHIP_NOT_PENDING: 409,
    CANNOT_MANAGE_SELF: 409,
    /**
     * 409 e não 403: quem pede tem autorização para apagar. O que
     * impede é o estado da crew — dinheiro parado, decisões por tomar
     * ou um plano a correr — e cada um desses estados desfaz-se.
     */
    CREW_HAS_FUNDS: 409,
    CREW_HAS_OPEN_DECISIONS: 409,
    CREW_HAS_ACTIVE_PLAN: 409,
};

/**
 * Estatuto HTTP de cada erro das filiações.
 */
const affiliationErrorStatusCodes: Record<AffiliationErrorCode, number> = {
    AFFILIATION_NOT_FOUND: 404,
    CREW_NOT_FOUND: 404,
    SERVER_NOT_FOUND: 404,
    /**
     * 409 e não 400: o pedido está bem escrito e quem o faz tem
     * autorização. O que impede é o estado em que a crew está.
     */
    CREW_ALREADY_AFFILIATED: 409,
    AFFILIATION_ALREADY_REQUESTED: 409,
    AFFILIATION_NOT_PENDING: 409,
    /**
     * 402 e não 403: quem pede tem autorização para o fazer — é dono do
     * servidor. O que falta é o plano dar para mais uma crew, e 402 é o
     * único estatuto que diz "isto resolve-se a pagar" em vez de "isto
     * não é para ti".
     */
    SERVER_CREW_LIMIT_REACHED: 402,
};

/**
 * Estatuto HTTP de cada erro da ingestão.
 */
const ingestErrorStatusCodes: Record<IngestErrorCode, number> = {
    SERVER_NOT_FOUND: 404,
    API_KEY_NOT_FOUND: 404,
    /** A chave apresentada não serve. Não se diz porquê, de propósito. */
    INVALID_API_KEY: 401,
    TOO_MANY_API_KEYS: 409,
};

const serverErrorStatusCodes: Record<ServerErrorCode, number> = {
    SERVER_NOT_FOUND: 404,
    SERVER_NAME_TAKEN: 409,
    MEMBERSHIP_NOT_FOUND: 404,
    ALREADY_MEMBER: 409,
    NOT_A_MEMBER: 404,
    MEMBERSHIP_NOT_PENDING: 409,
    CANNOT_MANAGE_SELF: 409,
    /** Pelas mesmas razões das crews. */
    SERVER_HAS_FUNDS: 409,
    SERVER_HAS_OPEN_DECISIONS: 409,
    SERVER_HAS_ACTIVE_PLAN: 409,
};

/**
 * Estatuto HTTP de cada erro do módulo de cobrança.
 */
const billingErrorStatusCodes: Record<BillingErrorCode, number> = {
    /**
     * 503 e não 500: não está avariado, está por configurar. A distinção
     * importa a quem instala a plataforma — um 500 mandava-o procurar um
     * defeito que não existe.
     */
    BILLING_NOT_CONFIGURED: 503,
    BILLING_OWNER_NOT_FOUND: 404,
    /**
     * 400 e não 403: quem pede tem toda a autorização para comprar um
     * plano para si. O que não existe é o plano — é o pedido que não faz
     * sentido, não quem o faz.
     */
    PLAN_IS_FOR_COMMUNITIES: 400,
    /** Já tem acesso para sempre: cobrar seria receber duas vezes. */
    ALREADY_LIFETIME: 409,
    /**
     * 400 e não 401: não é uma questão de credenciais. O corpo não
     * corresponde à assinatura, e o pedido não veio de quem diz.
     */
    INVALID_WEBHOOK_SIGNATURE: 400,
    /** O Stripe recusou ou não respondeu. Não é culpa de quem pediu. */
    STRIPE_REQUEST_FAILED: 502,
    SUBSCRIPTION_NOT_FROM_STRIPE: 409,
};

/**
 * Estatuto HTTP de cada erro do módulo de eventos.
 *
 * O mapa é exaustivo de propósito: um código novo sem estatuto não
 * compila, o que obriga a decidir o que devolver em vez de deixar cair
 * num 500 por omissão.
 */
const eventErrorStatusCodes: Record<EventErrorCode, number> = {
    EVENT_NOT_FOUND: 404,
    /** Um titular mal indicado é erro de programação, não do cliente. */
    INVALID_EVENT_OWNER: 500,
    EVENT_NOT_SCHEDULED: 409,
    EVENT_ALREADY_CLOSED: 409,
    INVALID_STATUS_TRANSITION: 409,
    /** O evento existe e o pedido é válido: o que falta é lugar. */
    EVENT_FULL: 409,
    ALREADY_SIGNED_UP: 409,
    NOT_SIGNED_UP: 404,
    /**
     * 403 e não 404: o evento existe e quem pede está identificado; o
     * que lhe falta é pertencer à comunidade que o organiza.
     */
    NOT_A_MEMBER: 403,
    ATTENDANCE_NOT_CONFIRMABLE: 409,
    STARTS_IN_THE_PAST: 400,
    ENDS_BEFORE_IT_STARTS: 400,
};

const treasuryErrorStatusCodes: Record<TreasuryErrorCode, number> = {
    /**
     * 404 e não 403: quem manda no servidor não tem por que saber que
     * aquela crew existe. Dizer "existe mas não joga aqui" transformava
     * a rota de transferência num verificador de nomes de crews.
     */
    CREW_DOES_NOT_PLAY_HERE: 404,
    WALLET_NOT_FOUND: 404,
    /** Titular inválido é erro de programação, não do cliente. */
    INVALID_WALLET_OWNER: 500,
    MOVEMENT_NOT_FOUND: 404,
    MOVEMENT_NOT_PENDING: 409,
    /**
     * 409 e não 402: o pedido é legítimo e quem o faz tem autorização,
     * apenas a tesouraria não tem o dinheiro neste momento.
     */
    INSUFFICIENT_FUNDS: 409,
    /**
     * 403 e não 404: quem cancela sem ser o proponente está identificado
     * e o movimento existe; falta-lhe é legitimidade sobre ele.
     */
    NOT_THE_PROPOSER: 403,
    DISTRIBUTION_NOT_FOUND: 404,
    DISTRIBUTION_NOT_PENDING: 409,
    /** Uma crew sem membros a quem pagar não é erro do cliente, é estado. */
    NO_MEMBERS_TO_PAY: 409,
    /**
     * 404: para esta tesouraria, um evento de outra comunidade não
     * existe. Dizer 403 confirmaria que existe algures.
     */
    EVENT_NOT_IN_THIS_TREASURY: 404,
    /** O evento existe; o que falta é alguém com presença confirmada. */
    NO_CONFIRMED_PARTICIPANTS: 409,
    /**
     * 500 e não 400: as partes são calculadas do lado do servidor, por
     * isso não baterem certo com o total é erro de programação nosso.
     */
    SHARES_DO_NOT_MATCH_TOTAL: 500,
};

const httpErrorNames: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    404: 'Not Found',
    402: 'Payment Required',
    403: 'Forbidden',
    409: 'Conflict',
    423: 'Locked',
    500: 'Internal Server Error',
    /** O Stripe recusou ou não respondeu. */
    502: 'Bad Gateway',
    /** A funcionalidade não está avariada: está por configurar. */
    503: 'Service Unavailable',
};

/**
 * Extrai estado e código de um erro sem assumir a sua forma.
 *
 * O Fastify tipa o erro como unknown porque um handler pode lançar
 * qualquer valor. Só confiamos nos campos que existem mesmo.
 */
const classifyError = (
    error: unknown,
): { statusCode: number; code: string; message: string } => {
    if (typeof error !== 'object' || error === null) {
        return {
            statusCode: 500,
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erro interno do servidor.',
        };
    }

    const candidate = error as {
        statusCode?: unknown;
        code?: unknown;
        message?: unknown;
    };

    const statusCode =
        typeof candidate.statusCode === 'number' ? candidate.statusCode : 500;

    return {
        statusCode,
        code: typeof candidate.code === 'string' ? candidate.code : 'ERROR',
        /**
         * A mensagem original só é revelada em erros do cliente.
         * Em erros 5xx podia expor detalhes internos.
         */
        message:
            statusCode < 500 && typeof candidate.message === 'string'
                ? candidate.message
                : 'Erro interno do servidor.',
    };
};

/**
 * Plugin global de tratamento de erros HTTP.
 *
 * Garante que erros de domínio e erros de validação não são
 * expostos como erro interno 500.
 */
const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
    fastify.setErrorHandler((error, request, reply) => {
        if (error instanceof AuthError) {
            const statusCode = authErrorStatusCodes[error.code];

            /**
             * Erros de autenticação são esperados e não indicam avaria.
             * Registamos com nível de aviso para não poluir os alertas.
             */
            request.log.warn(
                { err: error, code: error.code },
                'Pedido rejeitado pelo módulo de autenticação.',
            );

            reply.status(statusCode).send({
                statusCode,
                code: error.code,
                error: httpErrorNames[statusCode] ?? 'Error',
                message: error.message,
            });
            return;
        }

        if (error instanceof AuthorizationError) {
            /**
             * Ser o último a ter um cargo não é falta de permissões: é uma
             * regra de negócio que impede deixar uma crew sem líder ou um
             * servidor sem dono.
             */
            if (error.code === 'LAST_ROLE_HOLDER') {
                request.log.warn({ err: error }, 'Operação recusada por regra de negócio.');

                reply.status(409).send({
                    statusCode: 409,
                    code: error.code,
                    error: 'Conflict',
                    message: error.message,
                });
                return;
            }

            /**
             * 403 e não 401: o utilizador está identificado, apenas não
             * tem autorização. Devolver 401 faria o cliente tentar
             * autenticar-se de novo sem qualquer proveito.
             */
            request.log.warn(
                { err: error, missing: error.missingPermissions },
                'Pedido recusado por falta de permissões.',
            );

            reply.status(403).send({
                statusCode: 403,
                code: error.code,
                error: 'Forbidden',
                message: error.message,
                missingPermissions: error.missingPermissions,
            });
            return;
        }

        if (error instanceof CrewError) {
            const statusCode = crewErrorStatusCodes[error.code];

            request.log.warn(
                { err: error, code: error.code },
                'Pedido recusado pelo módulo de crews.',
            );

            reply.status(statusCode).send({
                statusCode,
                code: error.code,
                error: httpErrorNames[statusCode] ?? 'Error',
                message: error.message,
            });
            return;
        }

        if (error instanceof FriendError) {
            const statusCode = friendErrorStatusCodes[error.code];

            request.log.warn(
                { err: error, code: error.code },
                'Pedido recusado pelo módulo das amizades.',
            );

            reply.status(statusCode).send({
                statusCode,
                code: error.code,
                error: httpErrorNames[statusCode] ?? 'Error',
                message: error.message,
            });
            return;
        }

        if (error instanceof AffiliationError) {
            const statusCode = affiliationErrorStatusCodes[error.code];

            request.log.warn(
                { err: error, code: error.code },
                'Pedido recusado pelo módulo das filiações.',
            );

            reply.status(statusCode).send({
                statusCode,
                code: error.code,
                error: httpErrorNames[statusCode] ?? 'Error',
                message: error.message,
            });
            return;
        }

        if (error instanceof IngestError) {
            const statusCode = ingestErrorStatusCodes[error.code];

            request.log.warn(
                { err: error, code: error.code },
                'Pedido recusado pelo módulo da ingestão.',
            );

            reply.status(statusCode).send({
                statusCode,
                code: error.code,
                error: httpErrorNames[statusCode] ?? 'Error',
                message: error.message,
            });
            return;
        }

        if (error instanceof ServerError) {
            const statusCode = serverErrorStatusCodes[error.code];

            request.log.warn(
                { err: error, code: error.code },
                'Pedido recusado pelo módulo de servidores.',
            );

            reply.status(statusCode).send({
                statusCode,
                code: error.code,
                error: httpErrorNames[statusCode] ?? 'Error',
                message: error.message,
            });
            return;
        }

        if (error instanceof BillingError) {
            const statusCode = billingErrorStatusCodes[error.code];

            const log = statusCode < 500 ? request.log.warn : request.log.error;

            log.call(
                request.log,
                { err: error, code: error.code },
                'Pedido recusado pelo módulo de cobrança.',
            );

            reply.status(statusCode).send({
                statusCode,
                code: error.code,
                error: httpErrorNames[statusCode] ?? 'Error',
                message: error.message,
            });
            return;
        }

        if (error instanceof EventError) {
            const statusCode = eventErrorStatusCodes[error.code];

            const log = statusCode < 500 ? request.log.warn : request.log.error;

            log.call(
                request.log,
                { err: error, code: error.code },
                'Pedido recusado pelo módulo de eventos.',
            );

            reply.status(statusCode).send({
                statusCode,
                code: statusCode < 500 ? error.code : 'INTERNAL_SERVER_ERROR',
                error: httpErrorNames[statusCode] ?? 'Internal Server Error',
                message:
                    statusCode < 500 ? error.message : 'Erro interno do servidor.',
            });
            return;
        }

        if (error instanceof TreasuryError) {
            const statusCode = treasuryErrorStatusCodes[error.code];

            const log = statusCode < 500 ? request.log.warn : request.log.error;

            log.call(
                request.log,
                { err: error, code: error.code },
                'Pedido recusado pelo módulo de tesouraria.',
            );

            reply.status(statusCode).send({
                statusCode,
                code: statusCode < 500 ? error.code : 'INTERNAL_SERVER_ERROR',
                error: httpErrorNames[statusCode] ?? 'Internal Server Error',
                message:
                    statusCode < 500 ? error.message : 'Erro interno do servidor.',
            });
            return;
        }

        if (error instanceof UserError) {
            request.log.warn({ err: error, code: error.code }, 'Recurso não encontrado.');

            reply.status(404).send({
                statusCode: 404,
                code: error.code,
                error: 'Not Found',
                message: error.message,
            });
            return;
        }

        if (error instanceof SubscriptionError) {
            const statusCode = subscriptionErrorStatusCodes[error.code];

            const log = statusCode < 500 ? request.log.warn : request.log.error;

            log.call(
                request.log,
                { err: error, code: error.code },
                'Pedido recusado pelo módulo de subscrições.',
            );

            /**
             * Um titular inválido é erro de programação, não do cliente.
             * Como qualquer 5xx, não expõe a mensagem interna.
             */
            reply.status(statusCode).send({
                statusCode,
                code: statusCode < 500 ? error.code : 'INTERNAL_SERVER_ERROR',
                error: httpErrorNames[statusCode] ?? 'Internal Server Error',
                message:
                    statusCode < 500 ? error.message : 'Erro interno do servidor.',
            });
            return;
        }

        if (error instanceof ZodError) {
            request.log.warn(
                { issues: error.issues },
                'Pedido rejeitado por falha de validação.',
            );

            reply.status(400).send({
                statusCode: 400,
                code: 'VALIDATION_ERROR',
                error: 'Bad Request',
                message: 'Os dados enviados são inválidos.',
                issues: error.issues.map((issue) => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                })),
            });
            return;
        }

        /**
         * Erros já classificados pelo Fastify, como corpo JSON malformado
         * ou limite de pedidos excedido, mantêm o seu estado original.
         */
        const classified = classifyError(error);

        if (classified.statusCode < 500) {
            request.log.warn({ err: error }, 'Pedido rejeitado.');

            reply.status(classified.statusCode).send({
                statusCode: classified.statusCode,
                code: classified.code,
                error: httpErrorNames[classified.statusCode] ?? 'Error',
                message: classified.message,
            });
            return;
        }

        request.log.error(
            { err: error },
            'Erro capturado pelo error handler global.',
        );

        /**
         * Erros inesperados nunca expõem detalhes internos ao cliente.
         */
        reply.status(500).send({
            statusCode: 500,
            code: 'INTERNAL_SERVER_ERROR',
            error: 'Internal Server Error',
            message: 'Erro interno do servidor.',
        });
    });
};

export default fp(errorHandlerPlugin, {
    name: 'error-handler-plugin',
});
