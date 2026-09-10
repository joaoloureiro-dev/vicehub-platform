import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { Conquistas } from '../src/components/conquistas.js';
import { montarEcra, t } from './helpers.js';

const conquista = (slug: string) => ({
    slug,
    earnedAt: '2026-09-01T00:00:00.000Z',
});

describe('as conquistas de um perfil', () => {
    it('mostra o nome de cada uma', () => {
        montarEcra(<Conquistas conquistas={[conquista('attended_10')]} />);

        expect(screen.getByText(t.conquistas.nomes.attended_10)).toBeDefined();
    });

    it('e quando foi ganha', () => {
        montarEcra(<Conquistas conquistas={[conquista('ran_1')]} />);

        expect(
            screen.getByText(
                new Date('2026-09-01T00:00:00.000Z').toLocaleDateString('en'),
            ),
        ).toBeDefined();
    });

    /**
     * O dia em que o servidor der uma conquista que este ecrã ainda não
     * conhece, ela tem de aparecer na mesma.
     *
     * Esconder o que não se sabe nomear seria mentir por omissão a quem
     * a ganhou — e o ecrã ficava a decidir, sozinho e em silêncio, que
     * aquilo não contava.
     */
    it('mostra o identificador de uma que ainda não sabe nomear', () => {
        montarEcra(<Conquistas conquistas={[conquista('first_heist')]} />);

        expect(screen.getByText('first_heist')).toBeDefined();
    });

    /**
     * Sem nenhuma não aparece secção — nem título, nem caixa vazia a
     * dizer "ainda sem conquistas". Um perfil acabado de criar já é
     * suficientemente vazio sem lhe apontarmos o dedo.
     */
    it('não aparece de todo a quem ainda não tem nenhuma', () => {
        const { container } = montarEcra(<Conquistas conquistas={[]} />);

        expect(screen.queryByText(t.conquistas.titulo)).toBeNull();
        expect(container.querySelector('.conquistas')).toBeNull();
    });

    /**
     * E aceita não vir nada de todo: um perfil servido por uma versão
     * anterior da API não traz o campo, e isso não é razão para o ecrã
     * inteiro deixar de abrir.
     */
    it('aguenta o campo em falta sem rebentar', () => {
        const { container } = montarEcra(<Conquistas conquistas={undefined} />);

        expect(container.querySelector('.conquistas')).toBeNull();
    });
});
