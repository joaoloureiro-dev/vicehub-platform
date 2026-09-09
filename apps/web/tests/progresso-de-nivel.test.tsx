import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { ProgressoDeNivel } from '../src/components/progresso-de-nivel.js';
import { montarEcra, t } from './helpers.js';

/**
 * A barra de progresso do nível.
 *
 * Nenhuma regra de jogo vive aqui — a curva está na API — mas a divisão
 * vive, e uma divisão errada é uma barra que mente com toda a
 * confiança. É isso que estes casos verificam: a fração, as duas
 * pontas, e o que acontece quando não há nível seguinte.
 */
describe('progresso de nível', () => {
    const barra = () => screen.getByRole('progressbar') as HTMLProgressElement;

    it('mostra metade do caminho a meio do nível', () => {
        montarEcra(
            <ProgressoDeNivel
                nivel={2}
                xp="200"
                xpDoNivel="100"
                xpDoNivelSeguinte="300"
            />,
        );

        expect(barra().value).toBe(50);
    });

    it('mostra vazio no início do nível', () => {
        montarEcra(
            <ProgressoDeNivel
                nivel={2}
                xp="100"
                xpDoNivel="100"
                xpDoNivelSeguinte="300"
            />,
        );

        expect(barra().value).toBe(0);
    });

    it('diz quanto falta para o seguinte', () => {
        montarEcra(
            <ProgressoDeNivel
                nivel={2}
                xp="250"
                xpDoNivel="100"
                xpDoNivelSeguinte="300"
            />,
        );

        expect(screen.getByText(t.progressao.faltam('50', 3))).toBeDefined();
    });

    /**
     * O xp é BigInt do outro lado porque pode ser enorme. A conta que
     * aqui se faz é sobre a diferença entre dois níveis, que nunca é —
     * e é por isso que não se converte o xp inteiro para número.
     */
    it('aguenta um xp maior do que um número seguro', () => {
        montarEcra(
            <ProgressoDeNivel
                nivel={99}
                xp="9007199254740993"
                xpDoNivel="9007199254740893"
                xpDoNivelSeguinte="9007199254741093"
            />,
        );

        expect(barra().value).toBe(50);
        expect(screen.getByText(t.progressao.faltam('100', 100))).toBeDefined();
    });

    /** No topo não há seguinte, e prometer um seria mentir. */
    it('no topo não mostra barra nenhuma', () => {
        montarEcra(
            <ProgressoDeNivel
                nivel={100}
                xp="500000"
                xpDoNivel="495000"
                xpDoNivelSeguinte={null}
            />,
        );

        expect(screen.queryByRole('progressbar')).toBeNull();
        expect(screen.getByText(t.progressao.noTopo(100))).toBeDefined();
    });

    /**
     * Uma API mais antiga do que esta página não manda estes campos.
     * Uma barra a menos é melhor do que um ecrã que rebenta.
     */
    it('não parte o ecrã quando os números não vêm', () => {
        const { container } = montarEcra(
            <ProgressoDeNivel
                nivel={3}
                xp={undefined as unknown as string}
                xpDoNivel={undefined as unknown as string}
                xpDoNivelSeguinte={null}
            />,
        );

        expect(container.textContent).toBe('');
    });
});
