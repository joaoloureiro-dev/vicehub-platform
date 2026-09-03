import { sessionStore, type SessionUser } from './session.js';

export interface ApiErrorBody {
    code?: string;
    message?: string;
}

/**
 * Um erro que a API devolveu, com o código de domínio preservado.
 *
 * O `code` é o que permite ao ecrã dizer a coisa certa — `INVALID_
 * ACCOUNT_TOKEN` pede outro link, `EMAIL_ALREADY_VERIFIED` não é sequer
 * um problema. A mensagem do servidor serve de recurso, não de guião.
 */
export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export interface AuthPayload {
    accessToken: string;
    user: SessionUser;
}

const BASE = '/api/v1';

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    /**
     * Um pedido que não deve tentar renovar a sessão quando leva 401.
     * É o caso do próprio refresh e do login: aí, o 401 é a resposta,
     * não um acidente.
     */
    withoutRefresh?: boolean;
}

/**
 * O refresh em curso, se houver.
 *
 * **Esta variável é a parte que interessa.** O backend roda o refresh
 * token a cada utilização e trata uma segunda utilização do mesmo token
 * como roubo: derruba a sessão inteira. Um ecrã que faça três pedidos ao
 * mesmo tempo, com o access token expirado, levaria três 401 e dispararia
 * três refreshes com o mesmo cookie — e o próprio utilizador seria
 * expulso por parecer um atacante.
 *
 * Guardar aqui a promessa em curso faz os outros esperarem por ela em vez
 * de começarem a sua.
 */
let refreshInFlight: Promise<AuthPayload> | null = null;

const parseError = async (response: Response): Promise<ApiError> => {
    let body: ApiErrorBody = {};

    try {
        body = (await response.json()) as ApiErrorBody;
    } catch {
        /* Uma resposta sem corpo JSON não é motivo para rebentar aqui. */
    }

    return new ApiError(
        response.status,
        body.code ?? 'UNKNOWN_ERROR',
        body.message ?? 'Não foi possível completar o pedido.',
    );
};

const send = async (path: string, options: RequestOptions): Promise<Response> => {
    const token = sessionStore.getAccessToken();

    const headers: Record<string, string> = {};

    if (options.body !== undefined) {
        headers['content-type'] = 'application/json';
    }

    if (token) {
        headers['authorization'] = `Bearer ${token}`;
    }

    return fetch(`${BASE}${path}`, {
        method: options.method ?? 'GET',
        headers,
        /** O cookie do refresh token só segue com isto. */
        credentials: 'include',
        ...(options.body === undefined
            ? {}
            : { body: JSON.stringify(options.body) }),
    });
};

/**
 * Troca o cookie de refresh por um access token novo.
 *
 * Nunca corre duas vezes em paralelo: ver `refreshInFlight` acima.
 */
export const refreshSession = async (): Promise<AuthPayload> => {
    if (refreshInFlight) {
        return refreshInFlight;
    }

    refreshInFlight = (async () => {
        const response = await send('/auth/refresh', {
            method: 'POST',
            withoutRefresh: true,
        });

        if (!response.ok) {
            sessionStore.clear();

            throw await parseError(response);
        }

        const payload = (await response.json()) as AuthPayload;

        sessionStore.set(payload.accessToken, payload.user);

        return payload;
    })();

    try {
        return await refreshInFlight;
    } finally {
        /**
         * Libertado sempre, mesmo em caso de falha: de outra forma, uma
         * falha temporária deixaria uma promessa rejeitada colada aqui e
         * todos os pedidos seguintes falhariam por causa dela.
         */
        refreshInFlight = null;
    }
};

/**
 * Faz o pedido e, se o access token tiver expirado, renova-o e repete.
 *
 * Repete **uma vez**. Um segundo 401 depois de uma renovação bem
 * sucedida não é uma sessão expirada — é falta de autorização, e repetir
 * outra vez só daria um ciclo.
 */
export const api = async <T>(
    path: string,
    options: RequestOptions = {},
): Promise<T> => {
    let response = await send(path, options);

    if (response.status === 401 && !options.withoutRefresh) {
        try {
            await refreshSession();
        } catch {
            throw new ApiError(401, 'SESSION_EXPIRED', 'A sessão terminou.');
        }

        response = await send(path, options);
    }

    if (!response.ok) {
        throw await parseError(response);
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return (await response.json()) as T;
};

/** Usado apenas pelos testes, para isolar cada caso. */
export const resetApiState = (): void => {
    refreshInFlight = null;
};
