import { api, refreshSession, type AuthPayload } from '../lib/api.js';
import { sessionStore } from '../lib/session.js';

export const login = async (
    email: string,
    password: string,
): Promise<AuthPayload> => {
    const payload = await api<AuthPayload>('/auth/login', {
        method: 'POST',
        body: { email, password },
        withoutRefresh: true,
    });

    sessionStore.set(payload.accessToken, payload.user);

    return payload;
};

export const register = async (
    email: string,
    username: string,
    password: string,
): Promise<AuthPayload> => {
    const payload = await api<AuthPayload>('/auth/register', {
        method: 'POST',
        body: { email, username, password },
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

export const requestPasswordReset = (email: string): Promise<void> =>
    api<void>('/auth/password-reset', {
        method: 'POST',
        body: { email },
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
