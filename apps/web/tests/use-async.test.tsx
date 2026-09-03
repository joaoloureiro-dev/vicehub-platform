import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

import { useAsync } from '../src/lib/use-async.js';

const Sonda = ({
    carregar,
    chave,
}: {
    carregar: () => Promise<string>;
    chave: string;
}) => {
    const { data, loading, error } = useAsync(carregar, [chave]);

    if (loading) {
        return <p>a carregar</p>;
    }

    if (error) {
        return <p>erro: {String(error)}</p>;
    }

    return <p>dados: {data}</p>;
};

/**
 * O caso que este hook existe para resolver.
 *
 * Mudar de crew antes de a primeira responder cruza dois pedidos. Sem
 * proteção, a resposta lenta do primeiro chega depois e substitui a do
 * segundo — e o ecrã fica a mostrar a crew errada sem nada a indicar
 * que está errada.
 */
describe('pedidos que se cruzam', () => {
    it('a resposta atrasada do pedido antigo não substitui a do novo', async () => {
        let resolverPrimeiro: (valor: string) => void = () => undefined;

        const primeiro = vi.fn(
            () =>
                new Promise<string>((resolve) => {
                    resolverPrimeiro = resolve;
                }),
        );

        const segundo = vi.fn(() => Promise.resolve('crew nova'));

        const { rerender } = render(<Sonda carregar={primeiro} chave="a" />);

        expect(screen.getByText('a carregar')).toBeDefined();

        rerender(<Sonda carregar={segundo} chave="b" />);

        await waitFor(() => {
            expect(screen.getByText('dados: crew nova')).toBeDefined();
        });

        /*
         * Só agora responde o primeiro, fora de tempo. O `act` espera
         * que o React processe tudo o que essa resposta desencadear —
         * sem ele, o teste passava mesmo com a proteção removida, por
         * estar a olhar para o ecrã antes de ele ser redesenhado.
         */
        await act(async () => {
            resolverPrimeiro('crew antiga');
        });

        expect(screen.queryByText('dados: crew antiga')).toBeNull();
        expect(screen.getByText('dados: crew nova')).toBeDefined();
    });

    /**
     * O mesmo, mas quando o pedido antigo falha: uma falha fora de tempo
     * não pode apagar dados que já estão bons no ecrã.
     */
    it('a falha atrasada do pedido antigo não apaga o resultado do novo', async () => {
        let rejeitarPrimeiro: (erro: unknown) => void = () => undefined;

        const primeiro = vi.fn(
            () =>
                new Promise<string>((_resolve, reject) => {
                    rejeitarPrimeiro = reject;
                }),
        );

        const segundo = vi.fn(() => Promise.resolve('crew nova'));

        const { rerender } = render(<Sonda carregar={primeiro} chave="a" />);
        rerender(<Sonda carregar={segundo} chave="b" />);

        await waitFor(() => {
            expect(screen.getByText('dados: crew nova')).toBeDefined();
        });

        await act(async () => {
            rejeitarPrimeiro(new Error('tarde demais'));
        });

        expect(screen.queryByText(/^erro:/)).toBeNull();
        expect(screen.getByText('dados: crew nova')).toBeDefined();
    });

    it('não recarrega quando as dependências não mudam', async () => {
        const carregar = vi.fn(() => Promise.resolve('estável'));

        const { rerender } = render(<Sonda carregar={carregar} chave="a" />);

        await waitFor(() => {
            expect(screen.getByText('dados: estável')).toBeDefined();
        });

        rerender(<Sonda carregar={carregar} chave="a" />);
        rerender(<Sonda carregar={carregar} chave="a" />);

        expect(carregar).toHaveBeenCalledTimes(1);
    });

    it('recarrega quando as dependências mudam', async () => {
        const carregar = vi.fn(() => Promise.resolve('valor'));

        const { rerender } = render(<Sonda carregar={carregar} chave="a" />);

        await waitFor(() => {
            expect(screen.getByText('dados: valor')).toBeDefined();
        });

        rerender(<Sonda carregar={carregar} chave="b" />);

        await waitFor(() => {
            expect(carregar).toHaveBeenCalledTimes(2);
        });
    });
});
