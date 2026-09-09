import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApagarComunidade } from '../src/components/apagar-comunidade.js';
import { ApiError } from '../src/lib/api.js';
import { montarEcra, t } from './helpers.js';

/**
 * O controlo de apagar uma crew ou um servidor.
 *
 * O que aqui interessa provar é a fricção: o botão não faz nada
 * enquanto o nome não estiver escrito tal e qual. Sem isso, apagar
 * ficava a um clique de distância de quem passou por lá a explorar — e
 * é o único ecrã da plataforma onde um clique a mais tira uma
 * comunidade inteira do sítio.
 */
describe('apagar uma comunidade', () => {
    const NOME = 'Vice Kings';

    const montar = (apagar: () => Promise<void>) =>
        montarEcra(
            <ApagarComunidade tipo="crew" nome={NOME} apagar={apagar} />,
        );

    const botao = () => screen.getByRole('button', { name: t.zonaPerigo.botao });

    it('começa com o botão desligado', () => {
        montar(() => Promise.resolve());

        expect(botao().hasAttribute('disabled')).toBe(true);
    });

    it('mantém-no desligado com o nome quase certo', async () => {
        montar(() => Promise.resolve());

        await userEvent.type(screen.getByLabelText(t.zonaPerigo.confirmacao), 'Vice King');

        expect(botao().hasAttribute('disabled')).toBe(true);
    });

    it('liga-o com o nome escrito tal e qual', async () => {
        const apagar = vi.fn().mockResolvedValue(undefined);

        montar(apagar);

        await userEvent.type(
            screen.getByLabelText(t.zonaPerigo.confirmacao),
            NOME,
        );

        expect(botao().hasAttribute('disabled')).toBe(false);

        await userEvent.click(botao());

        await waitFor(() => {
            expect(apagar).toHaveBeenCalledTimes(1);
        });
    });

    /**
     * Colar o nome traz-lhe um espaço a mais com frequência, e recusar
     * por causa disso seria recusar quem escreveu o nome certo.
     */
    it('aceita o nome com espaços à volta', async () => {
        montar(() => Promise.resolve());

        await userEvent.type(
            screen.getByLabelText(t.zonaPerigo.confirmacao),
            `  ${NOME}  `,
        );

        expect(botao().hasAttribute('disabled')).toBe(false);
    });

    /**
     * As recusas da API não são falhas desta página: cada uma diz uma
     * coisa que se desfaz, e é isso que tem de chegar ao ecrã.
     */
    it.each([
        ['CREW_HAS_FUNDS', t.zonaPerigo.temSaldo],
        ['CREW_HAS_OPEN_DECISIONS', t.zonaPerigo.temDecisoes],
        ['CREW_HAS_ACTIVE_PLAN', t.zonaPerigo.temPlano],
    ])('mostra o motivo de %s', async (codigo, mensagem) => {
        montar(() =>
            Promise.reject(new ApiError(409, codigo as string, 'ignorado')),
        );

        await userEvent.type(
            screen.getByLabelText(t.zonaPerigo.confirmacao),
            NOME,
        );
        await userEvent.click(botao());

        expect((await screen.findByRole('alert')).textContent).toBe(
            mensagem as string,
        );
    });

    it('diz o genérico quando a falha não é uma recusa conhecida', async () => {
        montar(() => Promise.reject(new Error('rede')));

        await userEvent.type(
            screen.getByLabelText(t.zonaPerigo.confirmacao),
            NOME,
        );
        await userEvent.click(botao());

        expect((await screen.findByRole('alert')).textContent).toBe(
            t.zonaPerigo.naoFoiPossivel,
        );
    });
});
