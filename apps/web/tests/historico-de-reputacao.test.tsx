import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { HistoricoDeReputacao } from '../src/profile/components/historico-de-reputacao.js';
import type { ReputationEntry } from '../src/profile/profile.types.js';
import { montarEcra, t } from './helpers.js';

/**
 * De onde veio a reputação.
 *
 * O número aparece no perfil público de quem quer que lá chegue, e um
 * número sozinho só se pode acreditar. Esta lista é a razão de a
 * reputação ser gravada como factos: cada linha diz quanto, porquê, e de
 * que evento.
 */
describe('o histórico de reputação', () => {
    const presenca: ReputationEntry = {
        id: 'r1',
        amount: 1,
        reason: 'event_attended',
        at: '2026-09-10T20:00:00.000Z',
        event: {
            id: 'e1',
            name: 'Assalto ao banco',
            crewId: 'c1',
            serverId: null,
        },
    };

    const falta: ReputationEntry = {
        id: 'r2',
        amount: -1,
        reason: 'event_missed',
        at: '2026-09-11T20:00:00.000Z',
        event: {
            id: 'e2',
            name: 'Corrida na marina',
            crewId: 'c1',
            serverId: null,
        },
    };

    it('explica o que é a reputação a quem ainda não tem nenhuma', () => {
        montarEcra(<HistoricoDeReputacao entradas={[]} />);

        expect(screen.getByText(t.perfil.reputacaoVazia)).toBeDefined();
    });

    /**
     * Cada linha diz de que evento veio, e o evento é um link: a
     * pergunta seguinte é sempre "qual foi esse?".
     */
    it('aponta para o evento de onde cada ponto veio', () => {
        montarEcra(<HistoricoDeReputacao entradas={[presenca]} />);

        const link = screen.getByRole('link', { name: 'Assalto ao banco' });

        expect(link.getAttribute('href')).toBe('/crews/c1/eventos/e1');
    });

    /**
     * O sinal distingue as duas, e distingue-o em texto e não só em cor:
     * quem não separa o verde do vermelho continua a ler o menos.
     */
    it('mostra uma presença a somar e uma falta a tirar', () => {
        const { container } = montarEcra(
            <HistoricoDeReputacao entradas={[presenca, falta]} />,
        );

        const montantes = [...container.querySelectorAll('.ganho-quanto')].map(
            (no) => no.textContent,
        );

        expect(montantes).toEqual(['+1', '−1']);
    });

    /** E diz por palavras o que aconteceu, não só o número. */
    it('diz se a pessoa apareceu ou faltou', () => {
        montarEcra(<HistoricoDeReputacao entradas={[presenca, falta]} />);

        expect(
            screen.getByText(new RegExp(t.perfil.reputacaoApareceu)),
        ).toBeDefined();
        expect(
            screen.getByText(new RegExp(t.perfil.reputacaoFaltou)),
        ).toBeDefined();
    });

    /**
     * Um evento de servidor mora noutro endereço. Sem isto o link ia
     * para uma página de crew que não existe.
     */
    it('aponta um evento de servidor para o servidor', () => {
        montarEcra(
            <HistoricoDeReputacao
                entradas={[
                    {
                        ...presenca,
                        event: {
                            id: 'e9',
                            name: 'Noite de drift',
                            crewId: null,
                            serverId: 's1',
                        },
                    },
                ]}
            />,
        );

        const link = screen.getByRole('link', { name: 'Noite de drift' });

        expect(link.getAttribute('href')).toBe('/servidores/s1/eventos/e9');
    });

    /**
     * Apagar um evento não apaga a reputação que ele deu — o que
     * aconteceu, aconteceu — mas deixa de haver para onde apontar. A
     * linha fica, sem link.
     */
    it('mantém a linha de um evento que já não existe', () => {
        montarEcra(
            <HistoricoDeReputacao
                entradas={[{ ...presenca, event: null }]}
            />,
        );

        expect(
            screen.getByText(new RegExp(t.perfil.reputacaoEventoApagado)),
        ).toBeDefined();
        expect(screen.queryByRole('link')).toBeNull();
    });
});
