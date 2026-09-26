import { useEffect, useRef } from 'react';

/**
 * De quanto em quanto tempo se volta a perguntar, com o separador à
 * vista.
 *
 * Um minuto é a escolha entre duas coisas más. Mais curto, e cada
 * separador aberto passa a bater à porta da API sem que nada tenha
 * acontecido; mais longo, e um aviso chega tarde de mais para servir
 * para o que serve — dizer a alguém que estão à espera dele.
 *
 * O que torna isto barato é o que se pergunta: uma contagem sobre um
 * índice, e não a caixa toda.
 */
export const DE_QUANTO_EM_QUANTO = 60_000;

/**
 * O mínimo entre duas perguntas seguidas.
 *
 * Mudar de separador e voltar é uma coisa que se faz dez vezes num
 * minuto. Sem este chão, cada uma dessas vezes era um pedido.
 */
export const CHAO_ENTRE_PERGUNTAS = 10_000;

/**
 * Mantém um número fresco enquanto a página está à vista.
 *
 * O problema que resolve: o número de avisos por ler era pedido **uma
 * vez**, quando a aplicação arrancava. Numa aplicação de uma página só,
 * quem entra de manhã e navega a tarde inteira sem recarregar nunca
 * mais via um número novo — e um aviso que só aparece a quem carrega em
 * F5 é um aviso que não avisa ninguém.
 *
 * São duas coisas, e a segunda é a que mais interessa:
 *
 * - **de minuto a minuto**, para quem fica na mesma página a ler;
 * - **assim que o separador volta a estar à vista**, que é o que
 *   acontece a quem foi ao Discord e voltou. É nesse momento que a
 *   pessoa está mesmo a olhar, e é aí que o número tem de estar certo.
 *
 * Escondido não se pergunta nada. Um separador esquecido aberto durante
 * a noite não é uma pessoa à espera de um aviso, e perguntar por ele
 * era pagar mil pedidos por ninguém.
 */
export const useManterFresco = (
    recarregar: () => void,
    ligado = true,
): void => {
    /**
     * A função muda de identidade a cada render de quem a passa, e não
     * é ela que decide quando se recarrega. Guardada numa referência, o
     * relógio não é desmontado e montado outra vez a cada render.
     */
    const recarregarRef = useRef(recarregar);
    recarregarRef.current = recarregar;

    const ultima = useRef(0);

    useEffect(() => {
        if (!ligado) {
            return undefined;
        }

        const perguntar = () => {
            const agora = Date.now();

            if (agora - ultima.current < CHAO_ENTRE_PERGUNTAS) {
                return;
            }

            ultima.current = agora;
            recarregarRef.current();
        };

        const aoMudarDeVista = () => {
            if (document.visibilityState === 'visible') {
                perguntar();
            }
        };

        const relogio = setInterval(() => {
            if (document.visibilityState === 'visible') {
                perguntar();
            }
        }, DE_QUANTO_EM_QUANTO);

        document.addEventListener('visibilitychange', aoMudarDeVista);

        return () => {
            clearInterval(relogio);
            document.removeEventListener('visibilitychange', aoMudarDeVista);
        };
    }, [ligado]);
};
