/**
 * Onde vive o access token.
 *
 * **Em memória, e só em memória.** Guardá-lo no `localStorage` ou num
 * cookie legível por script poria a chave de acesso ao alcance de
 * qualquer script que a página venha a carregar — uma biblioteca de
 * terceiros comprometida, uma extensão, um XSS. Em memória, o token
 * morre com o separador, que é exatamente o que se quer.
 *
 * O que sobrevive a um F5 é o refresh token, e esse está num cookie
 * HttpOnly que o JavaScript não consegue ler. Ao arrancar, a aplicação
 * troca-o por um access token novo. É por isso que perder o token da
 * memória não custa nada: custa um pedido.
 */
export interface SessionUser {
    id: string;
    email: string;
    username: string;
}

let accessToken: string | null = null;
let user: SessionUser | null = null;

const listeners = new Set<() => void>();

const notify = (): void => {
    for (const listener of listeners) {
        listener();
    }
};

export const sessionStore = {
    getAccessToken: (): string | null => accessToken,

    getUser: (): SessionUser | null => user,

    set: (nextToken: string, nextUser: SessionUser): void => {
        accessToken = nextToken;
        user = nextUser;
        notify();
    },

    clear: (): void => {
        accessToken = null;
        user = null;
        notify();
    },

    subscribe: (listener: () => void): (() => void) => {
        listeners.add(listener);

        return () => {
            listeners.delete(listener);
        };
    },
};
