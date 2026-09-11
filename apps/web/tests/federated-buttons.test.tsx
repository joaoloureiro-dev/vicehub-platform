import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { FederatedButtons } from '../src/auth/components/federated-buttons.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

const responder = (body: unknown) => {
    /**
     * O endereço é declarado mesmo sem ser usado aqui: é o que permite
     * confirmar depois a que rota se perguntou.
     */
    const fetchFalso = vi.fn((_url: string) => Promise.resolve(json(200, body)));

    vi.stubGlobal('fetch', fetchFalso);

    return fetchFalso;
};

afterEach(() => {
    vi.unstubAllGlobals();
});

/**
 * Os botões de entrar sem password.
 *
 * Duas coisas a guardar, e ambas são sobre não mentir a quem lê: um
 * botão não aparece onde não funciona, e leva mesmo ao fornecedor — se
 * fosse um pedido nosso, a página de autorização vinha para dentro de
 * uma resposta que ninguém vê, e o botão não fazia nada.
 */
describe('as formas de entrar sem password', () => {
    it('mostra cada uma no seu endereço quando ambas estão configuradas', async () => {
        responder({ discord: true, google: true });

        montarEcra(<FederatedButtons />);

        expect(
            (await screen.findByText(t.auth.entrarComDiscord)).getAttribute('href'),
        ).toBe('/api/v1/auth/discord');
        expect(
            (await screen.findByText(t.auth.entrarComGoogle)).getAttribute('href'),
        ).toBe('/api/v1/auth/google');
    });

    /**
     * Os dois fornecedores são independentes. Ter só um configurado é o
     * caso normal, e não deve arrastar o outro para o ecrã.
     */
    it('mostra só o Discord quando a Google não está configurada', async () => {
        responder({ discord: true, google: false });

        montarEcra(<FederatedButtons />);

        await screen.findByText(t.auth.entrarComDiscord);

        expect(screen.queryByText(t.auth.entrarComGoogle)).toBeNull();
    });

    it('mostra só a Google quando o Discord não está configurado', async () => {
        responder({ discord: false, google: true });

        montarEcra(<FederatedButtons />);

        await screen.findByText(t.auth.entrarComGoogle);

        expect(screen.queryByText(t.auth.entrarComDiscord)).toBeNull();
    });

    /**
     * O "ou" é uma junta entre duas formas de entrar. Sem nada por
     * baixo seria uma junta a separar coisa nenhuma.
     */
    it('não mostra nem o separador quando não há nenhuma configurada', async () => {
        responder({ discord: false, google: false });

        montarEcra(<FederatedButtons />);

        await waitFor(() => {
            expect(screen.queryByText(t.auth.ouEntao)).toBeNull();
        });
        expect(screen.queryByText(t.auth.entrarComDiscord)).toBeNull();
        expect(screen.queryByText(t.auth.entrarComGoogle)).toBeNull();
    });

    /**
     * A pergunta é uma só para os dois. Um componente por fornecedor
     * faria dois pedidos iguais à mesma rota.
     */
    it('pergunta uma vez só, e à rota das formas de entrar', async () => {
        const fetchFalso = responder({ discord: true, google: true });

        montarEcra(<FederatedButtons />);

        await screen.findByText(t.auth.entrarComGoogle);

        expect(fetchFalso).toHaveBeenCalledTimes(1);
        expect(String(fetchFalso.mock.calls[0]?.[0])).toContain(
            '/auth/providers',
        );
    });

    /**
     * A API pode não responder. Aí não aparece botão nenhum — o que se
     * perde é uma forma de entrar, e o que se evita é um botão morto.
     */
    it('não mostra nada quando a pergunta falha', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sem rede'))));

        montarEcra(<FederatedButtons />);

        await waitFor(() => {
            expect(screen.queryByText(t.auth.entrarComDiscord)).toBeNull();
        });
        expect(screen.queryByText(t.auth.entrarComGoogle)).toBeNull();
    });
});
