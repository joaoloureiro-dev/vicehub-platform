import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { DiscordButton } from '../src/auth/components/discord-button.js';
import { montarEcra, t } from './helpers.js';

const json = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as Response;

afterEach(() => {
    vi.unstubAllGlobals();
});

/**
 * O botão de entrar com Discord.
 *
 * Duas coisas a guardar, e ambas são sobre não mentir a quem lê: o
 * botão não aparece onde não funciona, e leva mesmo ao Discord — se
 * fosse um pedido nosso, a página de autorização vinha para dentro de
 * uma resposta que ninguém vê, e o botão não fazia nada.
 */
describe('o botão do Discord', () => {
    it('não aparece quando a instalação não o tem configurado', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(200, { discord: false }))));

        montarEcra(<DiscordButton />);

        await waitFor(() => {
            expect(screen.queryByText(t.auth.entrarComDiscord)).toBeNull();
        });
    });

    it('aparece quando está configurado, e é uma navegação a sério', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(200, { discord: true }))));

        montarEcra(<DiscordButton />);

        const ligacao = await screen.findByText(t.auth.entrarComDiscord);

        expect(ligacao.getAttribute('href')).toBe('/api/v1/auth/discord');
    });

    /**
     * A API pode não responder. Aí o botão não aparece — o que se perde
     * é uma forma de entrar, e o que se evita é um botão morto.
     */
    it('não aparece quando a pergunta falha', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sem rede'))));

        montarEcra(<DiscordButton />);

        await waitFor(() => {
            expect(screen.queryByText(t.auth.entrarComDiscord)).toBeNull();
        });
    });
});
