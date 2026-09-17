import { describe, expect, it } from 'vitest';

import { EventParticipantStatus, reputacaoDe } from '@vicehub/database';

/**
 * O que mexe na reputação, e o que não mexe.
 *
 * A regra é curta e a escolha toda está em quais dos quatro desfechos
 * contam. Por isso o que aqui se verifica não é "devolve um número" —
 * é cada um dos quatro, um a um, e a relação entre eles.
 */
describe('a reputação de um desfecho', () => {
    /**
     * Quem organiza afirmou que a pessoa apareceu. É o único facto que
     * a plataforma tem sobre comparecer, e é de onde a reputação sai.
     */
    it('sobe com uma presença confirmada', () => {
        expect(reputacaoDe(EventParticipantStatus.confirmed)).toBe(1);
    });

    /** Disse que ia e não foi. */
    it('desce com uma falta', () => {
        expect(reputacaoDe(EventParticipantStatus.no_show)).toBe(-1);
    });

    /**
     * Uma falta tira exatamente o que uma presença dá.
     *
     * Escrito como relação, e não como dois números soltos: é isto que
     * impede que a reputação suba a quem se inscreve em tudo e aparece
     * em metade — e é essa pessoa que o número existe para distinguir
     * de quem aparece sempre.
     */
    it('uma falta apaga exatamente uma presença', () => {
        expect(
            reputacaoDe(EventParticipantStatus.confirmed)
            + reputacaoDe(EventParticipantStatus.no_show),
        ).toBe(0);
    });

    /**
     * Ninguém se pronunciou sobre esta pessoa: quem organiza não a
     * confirmou nem lhe marcou falta. Castigar por isso seria castigar
     * pelo silêncio de outra pessoa.
     */
    it('não mexe com quem ficou por confirmar', () => {
        expect(reputacaoDe(EventParticipantStatus.signed_up)).toBe(0);
    });

    /**
     * Desistir antes não é faltar. Avisar que já não se vai é o
     * comportamento que se quer, e não pode custar o mesmo que
     * desaparecer sem dizer nada.
     */
    it('não castiga quem avisou que já não ia', () => {
        expect(reputacaoDe(EventParticipantStatus.withdrawn)).toBe(0);
    });

    /**
     * E desistir não é o mesmo que faltar, dito como diferença e não
     * como dois valores: se um dia a desistência passar a custar, é
     * aqui que se dá por isso.
     */
    it('trata desistir e faltar de maneira diferente', () => {
        expect(reputacaoDe(EventParticipantStatus.withdrawn)).not.toBe(
            reputacaoDe(EventParticipantStatus.no_show),
        );
    });
});
