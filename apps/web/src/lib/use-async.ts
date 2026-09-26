import { useCallback, useEffect, useRef, useState } from 'react';

interface AsyncState<T> {
    data: T | null;
    loading: boolean;
    error: unknown;
}

/**
 * Carrega alguma coisa da API e diz em que estado está.
 *
 * A parte que importa é o `pedidoAtual`: se dois carregamentos se
 * cruzarem — mudar de crew antes de a primeira responder — só o último
 * escreve no estado. Sem isto, a resposta lenta do primeiro chegava
 * depois e substituía a do segundo, e o ecrã ficava a mostrar a crew
 * errada sem nada a indicar que estava errado.
 */
export const useAsync = <T>(
    carregar: () => Promise<T>,
    dependencias: readonly unknown[],
): AsyncState<T> & { reload: () => void; refrescar: () => void } => {
    const [estado, setEstado] = useState<AsyncState<T>>({
        data: null,
        loading: true,
        error: null,
    });

    const [tentativa, setTentativa] = useState(0);
    const pedidoAtual = useRef(0);

    /**
     * A função de carregamento muda de identidade a cada render, e não é
     * ela que decide quando recarregar — são as dependências declaradas
     * por quem chama.
     */
    const carregarRef = useRef(carregar);
    carregarRef.current = carregar;

    useEffect(() => {
        const meuPedido = pedidoAtual.current + 1;
        pedidoAtual.current = meuPedido;

        setEstado((anterior) => ({ ...anterior, loading: true, error: null }));

        carregarRef
            .current()
            .then((data) => {
                if (pedidoAtual.current === meuPedido) {
                    setEstado({ data, loading: false, error: null });
                }
            })
            .catch((error: unknown) => {
                if (pedidoAtual.current === meuPedido) {
                    setEstado({ data: null, loading: false, error });
                }
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...dependencias, tentativa]);

    const reload = useCallback(() => {
        setTentativa((valor) => valor + 1);
    }, []);

    /**
     * Volta a carregar **por trás**, sem mexer no que está no ecrã até
     * haver resposta.
     *
     * É a diferença entre um pedido que a pessoa fez e um que o
     * relógio fez por ela. Num recarregamento normal, uma falha de rede
     * é informação: ela carregou num botão e tem de saber que não
     * resultou. Num que corre de minuto a minuto, a mesma falha
     * substituía a página que ela está a ler por um aviso de erro que
     * ela não pediu — e uma lista que desaparece sozinha é pior do que
     * uma lista com um minuto de atraso.
     *
     * Por isso também não acende o `loading`: não há nada a esperar,
     * há uma página já desenhada que fica como está.
     */
    const refrescar = useCallback(() => {
        const meuPedido = pedidoAtual.current + 1;
        pedidoAtual.current = meuPedido;

        carregarRef
            .current()
            .then((data) => {
                if (pedidoAtual.current === meuPedido) {
                    setEstado({ data, loading: false, error: null });
                }
            })
            .catch(() => undefined);
    }, []);

    return { ...estado, reload, refrescar };
};
