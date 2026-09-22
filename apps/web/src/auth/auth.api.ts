import { api, refreshSession, type AuthPayload } from '../lib/api.js';
import { sessionStore } from '../lib/session.js';

export const login = async (
    email: string,
    password: string,
    /**
     * O cartão do CAPTCHA, quando a instalação tem um.
     *
     * Vai por omissão e não é exigido aqui: uma instalação sem CAPTCHA
     * não tem como o produzir, e quem decide se ele é preciso é o
     * servidor — que é o único sítio onde essa decisão significa
     * alguma coisa.
     */
    captchaToken?: string,
): Promise<AuthPayload> => {
    const payload = await api<AuthPayload>('/auth/login', {
        method: 'POST',
        body: { email, password, ...(captchaToken ? { captchaToken } : {}) },
        withoutRefresh: true,
    });

    sessionStore.set(payload.accessToken, payload.user);

    return payload;
};

export const register = async (
    email: string,
    username: string,
    password: string,
    captchaToken?: string,
): Promise<AuthPayload> => {
    const payload = await api<AuthPayload>('/auth/register', {
        method: 'POST',
        body: {
            email,
            username,
            password,
            ...(captchaToken ? { captchaToken } : {}),
        },
        withoutRefresh: true,
    });

    sessionStore.set(payload.accessToken, payload.user);

    return payload;
};

/**
 * Termina a sessão deste dispositivo.
 *
 * A memória é limpa mesmo que o pedido falhe. Deixar o utilizador com
 * ar de autenticado depois de carregar em sair é a pior das duas
 * respostas possíveis a uma falha de rede.
 */
export const logout = async (): Promise<void> => {
    try {
        await api<void>('/auth/logout', { method: 'POST' });
    } finally {
        sessionStore.clear();
    }
};

/**
 * Termina a sessão em todo o lado, incluindo aqui.
 *
 * A API revoga todas as sessões e invalida os access tokens já
 * emitidos — este inclusive. Por isso a memória é limpa a seguir, tal
 * como no `logout`: o pedido seguinte desta aba levaria 401 e o ecrã
 * ficaria com ar de autenticado até lá.
 *
 * Existia na API desde sempre e não tinha por onde ser chamado. Quem
 * desconfia que a conta lhe foi apanhada não tinha nada a fazer no
 * produto senão trocar a password — o que não expulsa ninguém que já lá
 * esteja dentro.
 */
export const logoutEverywhere = async (): Promise<void> => {
    try {
        await api<void>('/auth/logout-all', { method: 'POST' });
    } finally {
        sessionStore.clear();
    }
};

export const requestPasswordReset = (
    email: string,
    captchaToken?: string,
): Promise<void> =>
    api<void>('/auth/password-reset', {
        method: 'POST',
        body: { email, ...(captchaToken ? { captchaToken } : {}) },
        withoutRefresh: true,
    });

export const resetPassword = (token: string, password: string): Promise<void> =>
    api<void>('/auth/password-reset/confirm', {
        method: 'POST',
        body: { token, password },
        withoutRefresh: true,
    });

export const verifyEmail = (token: string): Promise<void> =>
    api<void>('/auth/email-verification/confirm', {
        method: 'POST',
        body: { token },
        withoutRefresh: true,
    });

export const requestEmailVerification = (): Promise<void> =>
    api<void>('/auth/email-verification', { method: 'POST' });

/**
 * Tenta recuperar a sessão a partir do cookie, ao arrancar.
 *
 * Não ter sessão é o caso normal de quem chega ao site pela primeira
 * vez, e por isso não é tratado como erro.
 */
export const restoreSession = async (): Promise<boolean> => {
    try {
        await refreshSession();

        return true;
    } catch {
        return false;
    }
};

/**
 * Que formas de entrar esta instalação oferece.
 *
 * Pergunta-se porque nem o Discord nem a Google têm de estar
 * configurados — são independentes um do outro —, e um botão que leva a
 * um erro é pior do que botão nenhum.
 */
export interface AuthProviders {
    discord: boolean;
    google: boolean;
}

export const getAuthProviders = (): Promise<AuthProviders> =>
    api<AuthProviders>('/auth/providers', { withoutRefresh: true });

/**
 * Onde começa a entrada por cada fornecedor.
 *
 * São navegações do browser e não pedidos nossos: o fornecedor tem de
 * ver a pessoa, e uma resposta a `fetch` não a levaria a lado nenhum.
 * Daí serem endereços e não funções que chamam a API.
 */
export const ENDERECO_DISCORD = '/api/v1/auth/discord';
export const ENDERECO_GOOGLE = '/api/v1/auth/google';
