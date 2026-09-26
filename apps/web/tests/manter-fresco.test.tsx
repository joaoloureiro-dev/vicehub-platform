import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';

import {
    CHAO_ENTRE_PERGUNTAS,
    DE_QUANTO_EM_QUANTO,
    useManterFresco,
} from '../src/lib/manter-fresco.js';
import { montarEcra, verSeparador } from './helpers.js';

/**
 * O relógio que mantém um número honesto.
 *
 * O número de avisos por ler era pedido **uma vez**, no arranque da
 * aplicação. Numa aplicação de uma página só, quem entra de manhã e
 * navega a tarde inteira sem recarregar nunca mais via um número novo —
 * e um aviso que só aparece a quem carrega em F5 não avisa ninguém.
 *
 * O que aqui se guarda são as três regras que o tornam barato:
 * pergunta-se de minuto a minuto, pergunta-se **assim que o separador
 * volta a estar à vista**, e não se pergunta nada enquanto está
 * escondido.
 */
const Consumidor = ({
    recarregar,
    ligado,
}: {
    recarregar: () => void;
    ligado?: boolean;
}) => {
    useManterFresco(recarregar, ligado);

    return <span>montado</span>;
};

beforeEach(() => {
    vi.useFakeTimers();
    verSeparador('visible');
});

afterEach(() => {
    vi.useRealTimers();
});

describe('manter um número fresco', () => {
    it('volta a perguntar de minuto a minuto', () => {
        const recarregar = vi.fn();

        montarEcra(<Consumidor recarregar={recarregar} />);

        expect(recarregar).toHaveBeenCalledTimes(0);

        act(() => {
            vi.advanceTimersByTime(DE_QUANTO_EM_QUANTO);
        });

        expect(recarregar).toHaveBeenCalledTimes(1);

        act(() => {
            vi.advanceTimersByTime(DE_QUANTO_EM_QUANTO);
        });

        expect(recarregar).toHaveBeenCalledTimes(2);
    });

    /**
     * O momento que mais interessa: quem foi ao Discord e voltou está
     * mesmo a olhar para o ecrã, e é aí que o número tem de estar
     * certo. Esperar pelo minuto seguinte era mostrar-lhe um número
     * errado precisamente enquanto ele o lê.
     */
    it('e pergunta assim que o separador volta a estar à vista', () => {
        const recarregar = vi.fn();

        montarEcra(<Consumidor recarregar={recarregar} />);

        verSeparador('hidden');
        verSeparador('visible');

        expect(recarregar).toHaveBeenCalledTimes(1);
    });

    /**
     * Um separador esquecido aberto durante a noite não é uma pessoa à
     * espera de um aviso. Perguntar por ele era pagar mil pedidos por
     * ninguém.
     */
    it('não pergunta nada enquanto está escondido', () => {
        const recarregar = vi.fn();

        montarEcra(<Consumidor recarregar={recarregar} />);

        verSeparador('hidden');

        act(() => {
            vi.advanceTimersByTime(DE_QUANTO_EM_QUANTO * 5);
        });

        expect(recarregar).toHaveBeenCalledTimes(0);
    });

    /**
     * Mudar de separador e voltar é uma coisa que se faz dez vezes num
     * minuto. Sem um chão entre perguntas, cada uma dessas vezes era um
     * pedido à API.
     */
    it('e não pergunta duas vezes seguidas por dez idas e voltas', () => {
        const recarregar = vi.fn();

        montarEcra(<Consumidor recarregar={recarregar} />);

        for (let volta = 0; volta < 10; volta += 1) {
            verSeparador('hidden');
            verSeparador('visible');
        }

        expect(recarregar).toHaveBeenCalledTimes(1);

        /** Passado o chão, a volta seguinte já conta. */
        act(() => {
            vi.advanceTimersByTime(CHAO_ENTRE_PERGUNTAS);
        });

        verSeparador('hidden');
        verSeparador('visible');

        expect(recarregar).toHaveBeenCalledTimes(2);
    });

    /**
     * Sem sessão não há nada a contar, e perguntar dava 401 a quem só
     * está a ver o diretório de crews.
     */
    it('não pergunta nada a quem não tem sessão', () => {
        const recarregar = vi.fn();

        montarEcra(<Consumidor recarregar={recarregar} ligado={false} />);

        verSeparador('hidden');
        verSeparador('visible');

        act(() => {
            vi.advanceTimersByTime(DE_QUANTO_EM_QUANTO * 3);
        });

        expect(recarregar).toHaveBeenCalledTimes(0);
    });

    /**
     * E cala-se ao sair. Um relógio que sobrevive ao componente é um
     * pedido a cada minuto por uma página que já ninguém tem aberta.
     */
    it('e cala-se quando a página sai do ecrã', () => {
        const recarregar = vi.fn();

        const ecra = montarEcra(<Consumidor recarregar={recarregar} />);

        act(() => {
            vi.advanceTimersByTime(DE_QUANTO_EM_QUANTO);
        });

        expect(recarregar).toHaveBeenCalledTimes(1);

        ecra.unmount();

        act(() => {
            vi.advanceTimersByTime(DE_QUANTO_EM_QUANTO * 3);
        });

        verSeparador('hidden');
        verSeparador('visible');

        expect(recarregar).toHaveBeenCalledTimes(1);
    });
});
