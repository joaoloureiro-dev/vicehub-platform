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
 * A sonda que mostra os dois botões: o recarregamento que a pessoa pede
 * e o que corre por trás.
 */
const SondaComBotoes = ({ carregar }: { carregar: () => Promise<string> }) => {
    const { data, loading, error, reload, refrescar } = useAsync(carregar, []);

    return (
        <>
            <p>
                {loading
                    ? 'a carregar'
                    : error
                        ? `erro: ${String(error)}`
                        : `dados: ${String(data)}`}
            </p>
            <button type="button" onClick={reload}>
                recarregar
            </button>
            <button type="button" onClick={refrescar}>
                refrescar
            </button>
        </>
    );
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

/**
 * Um recarregamento que a pessoa pediu e um que o relógio pediu por ela
 * não podem falhar da mesma maneira.
 *
 * Quem carrega num botão tem de saber que não resultou. Mas um pedido
 * que corre de minuto a minuto, sozinho, não pode substituir a página
 * que a pessoa está a ler por um aviso de erro que ela não pediu — uma
 * lista que desaparece sozinha é pior do que uma lista com um minuto
 * de atraso.
 */
describe('refrescar por trás', () => {
    it('põe os dados novos quando resulta', async () => {
        const respostas = ['primeira', 'segunda'];

        const carregar = vi.fn(() =>
            Promise.resolve(respostas.shift() ?? 'esgotou'),
        );

        render(<SondaComBotoes carregar={carregar} />);

        await waitFor(() => {
            expect(screen.getByText('dados: primeira')).toBeDefined();
        });

        await act(async () => {
            screen.getByText('refrescar').click();
        });

        expect(screen.getByText('dados: segunda')).toBeDefined();
    });

    it('e deixa o ecrã como está quando falha', async () => {
        let falhar = false;

        const carregar = vi.fn(() =>
            falhar
                ? Promise.reject(new Error('rede'))
                : Promise.resolve('o que estava lá'),
        );

        render(<SondaComBotoes carregar={carregar} />);

        await waitFor(() => {
            expect(screen.getByText('dados: o que estava lá')).toBeDefined();
        });

        falhar = true;

        await act(async () => {
            screen.getByText('refrescar').click();
        });

        expect(screen.queryByText(/^erro:/)).toBeNull();
        expect(screen.getByText('dados: o que estava lá')).toBeDefined();
    });

    /**
     * E não acende o "a carregar": não há nada a esperar, há uma página
     * já desenhada que fica como está.
     */
    it('e não pisca o a carregar enquanto vai perguntar', async () => {
        let resolver: (valor: string) => void = () => undefined;

        let primeiro = true;

        const carregar = vi.fn(() => {
            if (primeiro) {
                primeiro = false;

                return Promise.resolve('o que estava lá');
            }

            return new Promise<string>((resolve) => {
                resolver = resolve;
            });
        });

        render(<SondaComBotoes carregar={carregar} />);

        await waitFor(() => {
            expect(screen.getByText('dados: o que estava lá')).toBeDefined();
        });

        await act(async () => {
            screen.getByText('refrescar').click();
        });

        expect(screen.queryByText('a carregar')).toBeNull();
        expect(screen.getByText('dados: o que estava lá')).toBeDefined();

        await act(async () => {
            resolver('o que chegou depois');
        });

        expect(screen.getByText('dados: o que chegou depois')).toBeDefined();
    });

    /**
     * O que a pessoa pede é outra coisa: aí uma falha é informação, e
     * esconder-lha era deixá-la a olhar para dados velhos convencida de
     * que estão certos.
     */
    it('mas um recarregamento pedido mostra a falha', async () => {
        let falhar = false;

        const carregar = vi.fn(() =>
            falhar
                ? Promise.reject(new Error('rede'))
                : Promise.resolve('o que estava lá'),
        );

        render(<SondaComBotoes carregar={carregar} />);

        await waitFor(() => {
            expect(screen.getByText('dados: o que estava lá')).toBeDefined();
        });

        falhar = true;

        await act(async () => {
            screen.getByText('recarregar').click();
        });

        await waitFor(() => {
            expect(screen.getByText(/^erro:/)).toBeDefined();
        });
    });
});
