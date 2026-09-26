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
import { getPending, type PendingForUser } from './pending.api.js';

interface Contexto {
    /** `null` enquanto não há resposta, ou quando não há sessão. */
    pendente: PendingForUser | null;
    /** Volta a perguntar à API. */
    recarregar: () => void;
}

const PendingContext = createContext<Contexto>({
    pendente: null,
    recarregar: () => undefined,
});

/**
 * O que está à espera desta pessoa, pedido uma vez e partilhado.
 *
 * Nasceu de dois problemas que são o mesmo problema.
 *
 * O primeiro é medível: abrir `/eu/comunidades` pedia
 * `/users/me/pending` **três vezes**. A navegação pedia-o para o número
 * ao lado de "as minhas", a secção do topo da página pedia-o outra vez
 * para a lista, e nenhuma das duas sabia da outra.
 *
 * O segundo é o que se vê: sem uma origem só, nada podia dizer à
 * navegação que o número mudou. Quem abrisse a página, visse as
 * respostas e saísse ficava com um número ao lado de "as minhas" que já
 * não correspondia a nada — e um número que mente deixa de se ler ao
 * fim de dois dias, que é o mesmo que não estar lá.
 */
export const PendingProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [pendente, setPendente] = useState<PendingForUser | null>(null);

    const idDaSessao = user?.id;

    const recarregar = useCallback(() => {
        if (idDaSessao === undefined) {
            setPendente(null);

            return;
        }

        /**
         * Uma falha aqui não é para mostrar: isto desenha um número ao
         * lado de um item de menu. Sem resposta fica sem número, que é
         * o mesmo que a plataforma mostra a quem não tem nada à espera.
         *
         * E não apaga o que já lá estava, pela mesma razão da caixa de
         * avisos: isto corre sozinho, e um número que pisca a cada
         * falha de rede é um número que se deixa de ler.
         */
        void getPending()
            .then(setPendente)
            .catch(() => undefined);
    }, [idDaSessao]);

    useEffect(recarregar, [recarregar]);

    /**
     * Pela mesma razão que a caixa de avisos, e com o mesmo relógio:
     * uma candidatura respondida enquanto a pessoa navega é uma
     * resposta que ela merece ver sem recarregar a página. Duas
     * grafias da mesma regra era a espécie de diferença que ninguém se
     * lembra de ter decidido.
     */
    useManterFresco(recarregar, idDaSessao !== undefined);

    return (
        <PendingContext.Provider value={{ pendente, recarregar }}>
            {children}
        </PendingContext.Provider>
    );
};

export const usePendente = (): Contexto => useContext(PendingContext);
