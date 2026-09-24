import { describe, expect, it } from 'vitest';

import {
    AVALIACAO_MAXIMA,
    AVALIACAO_MINIMA,
    mediaDasAvaliacoes,
} from '@vicehub/database';

/**
 * A média de quem vende.
 *
 * Duas decisões vivem aqui, e as duas mudam o que um perfil diz sobre
 * uma pessoa:
 *
 * - **sem avaliações não há média** — `null`, e não zero. Zero é a
 *   pior nota da escala, e quem ainda não vendeu nada não a merece;
 * - **uma casa decimal** — `4,3` diz o que há a dizer, e `4,27` finge
 *   uma precisão que doze avaliações não têm.
 */
describe('a média das avaliações', () => {
    it('não existe quando não há avaliações', () => {
        expect(mediaDasAvaliacoes([])).toBeNull();
    });

    it('e não é zero, que é uma nota', () => {
        expect(mediaDasAvaliacoes([])).not.toBe(0);
    });

    it('arredonda a uma casa decimal', () => {
        /** 13/3 = 4,333… */
        expect(mediaDasAvaliacoes([5, 4, 4])).toBe(4.3);

        /** 14/3 = 4,666… */
        expect(mediaDasAvaliacoes([5, 5, 4])).toBe(4.7);
    });

    it('e não devolve a dízima inteira', () => {
        const media = mediaDasAvaliacoes([5, 4, 4]) as number;

        expect(String(media).length).toBeLessThanOrEqual(3);
    });

    it('uma avaliação só é a própria nota', () => {
        expect(mediaDasAvaliacoes([2])).toBe(2);
    });

    it('a escala vai de um a cinco', () => {
        expect(AVALIACAO_MINIMA).toBe(1);
        expect(AVALIACAO_MAXIMA).toBe(5);
        expect(mediaDasAvaliacoes([AVALIACAO_MINIMA, AVALIACAO_MAXIMA])).toBe(3);
    });
});
