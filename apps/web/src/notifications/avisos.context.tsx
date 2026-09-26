import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from 'react';

import { useAuth } from '../auth/auth.context.js';
import { useManterFresco } from '../lib/manter-fresco.js';
import { countUnread } from './avisos.api.js';

interface Contexto {
    /** Quantos estão por ler. Zero também quando não há sessão. */
    porLer: number;
    /** Volta a perguntar à API. */
    recarregar: () => void;
}

const AvisosContext = createContext<Contexto>({
    porLer: 0,
    recarregar: () => undefined,
});

/**
 * O número de avisos por ler, pedido uma vez e partilhado.
 *
 * Pelas mesmas duas razões do contexto das pendências, que é o mesmo
 * problema com outro nome. A barra precisa do número em todos os ecrãs,
 * e a página dos avisos precisa de o poder pôr a zero depois de a
 * pessoa os ler — sem uma origem só, a barra ficava a mostrar um número
 * que já não correspondia a nada, e um número que mente deixa de se ler
 * ao fim de dois dias.
 *
 * Só a contagem, e não a lista: a barra desenha um algarismo, e pedir
 * trinta avisos inteiros a cada mudança de página era pagar a caixa
 * toda para isso.
 */
export const AvisosProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [porLer, setPorLer] = useState(0);

    const idDaSessao = user?.id;

    const recarregar = useCallback(() => {
        if (idDaSessao === undefined) {
            setPorLer(0);

            return;
        }

        /**
         * Uma falha aqui não é para mostrar: isto desenha um número ao
         * lado de um item de menu, e um ecrã de erro por causa de um
         * algarismo era pagar caro de mais por ele. Sem resposta fica
         * sem número, que é o que a plataforma mostra a quem não tem
         * nada à espera.
         *
         * **Mas não apaga o que já lá estava.** Isto passou a correr
         * sozinho de minuto a minuto: pôr zero a cada falha de rede
         * fazia o número desaparecer à frente de quem tem cinco avisos
         * por ler, e voltar um minuto depois. Um número que pisca é um
         * número que se deixa de ler.
         */
        void countUnread()
            .then((resposta) => {
                setPorLer(resposta.unread);
            })
            .catch(() => undefined);
    }, [idDaSessao]);

    useEffect(recarregar, [recarregar]);

    /**
     * E volta a perguntar enquanto a pessoa lá está.
     *
     * Sem isto, o número era pedido **uma vez**, no arranque. Quem
     * entrasse de manhã e navegasse a tarde inteira sem recarregar a
     * página nunca mais via um número novo — e um aviso que só aparece
     * a quem carrega em F5 é um aviso que não avisa ninguém.
     */
    useManterFresco(recarregar, idDaSessao !== undefined);

    return (
        <AvisosContext.Provider value={{ porLer, recarregar }}>
            {children}
        </AvisosContext.Provider>
    );
};

export const useAvisos = (): Contexto => useContext(AvisosContext);
