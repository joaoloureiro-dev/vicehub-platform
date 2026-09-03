import { describe, expect, it, vi } from 'vitest';

import { sessionStore } from '../src/lib/session.js';

const utilizador = { id: 'u1', email: 'player@vicehub.test', username: 'player' };

describe('onde vive o access token', () => {
    /**
     * O token de acesso não pode sair da memória.
     *
     * No `localStorage` ou num cookie legível, fica ao alcance de
     * qualquer script que a página venha a carregar — uma biblioteca
     * comprometida, uma extensão, um XSS. Em memória morre com o
     * separador, e o que sobrevive a um F5 é o cookie HttpOnly, que o
     * JavaScript não lê.
     */
    it('não escreve em armazenamento nenhum do browser', () => {
        const local = vi.spyOn(Storage.prototype, 'setItem');

        sessionStore.set('token-secreto', utilizador);

        expect(local).not.toHaveBeenCalled();
        expect(window.localStorage.length).toBe(0);
        expect(window.sessionStorage.length).toBe(0);
        expect(document.cookie).not.toContain('token-secreto');
    });

    it('avisa quem estiver a ouvir quando a sessão muda', () => {
        const ouvinte = vi.fn();
        const parar = sessionStore.subscribe(ouvinte);

        sessionStore.set('token', utilizador);
        sessionStore.clear();

        expect(ouvinte).toHaveBeenCalledTimes(2);

        parar();
        sessionStore.set('token', utilizador);

        expect(ouvinte).toHaveBeenCalledTimes(2);
    });

    it('esquece o utilizador e o token ao mesmo tempo', () => {
        sessionStore.set('token', utilizador);
        sessionStore.clear();

        expect(sessionStore.getAccessToken()).toBeNull();
        expect(sessionStore.getUser()).toBeNull();
    });
});
