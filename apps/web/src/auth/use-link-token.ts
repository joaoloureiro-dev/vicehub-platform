import { useState } from 'react';

/**
 * Lê o segredo que veio no link e **apaga-o do endereço**.
 *
 * Um token na barra de endereços é um token que sai de lá: fica no
 * histórico do browser, aparece numa captura de ecrã, e segue no
 * `Referer` de qualquer pedido que a página faça para fora. Lê-se uma
 * vez, guarda-se em memória, e a barra fica limpa.
 *
 * A troca é feita com `replaceState` e não com `pushState`: carregar em
 * "voltar" não deve devolver o endereço com o segredo lá dentro.
 */
export const useLinkToken = (): string | null => {
    const [token] = useState<string | null>(() => {
        const parametros = new URLSearchParams(window.location.search);

        const valor = parametros.get('token');

        if (!valor) {
            return null;
        }

        parametros.delete('token');

        const query = parametros.toString();

        window.history.replaceState(
            null,
            '',
            `${window.location.pathname}${query ? `?${query}` : ''}`,
        );

        return valor;
    });

    return token;
};
