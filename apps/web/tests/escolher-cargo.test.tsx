import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EscolherCargo } from '../src/components/escolher-cargo.js';
import { CARGOS_DA_CREW } from '../src/crews/crew.types.js';
import { montarEcra, t } from './helpers.js';

/**
 * O campo onde se escolhe o cargo de alguém.
 *
 * Existe uma vez e serve as crews e os servidores. Estes testes são
 * sobre o que ele faz sozinho; quem o pode ver decide-se nas páginas, e
 * está provado lá.
 */
describe('escolher o cargo de alguém', () => {
    const montar = (atual: string, aoEscolher = vi.fn()) => {
        montarEcra(
            <EscolherCargo
                cargos={CARGOS_DA_CREW}
                atual={atual}
                nome="outro"
                desativado={false}
                aoEscolher={aoEscolher}
            />,
            '/',
        );

        return aoEscolher;
    };

    it('mostra o cargo em vigor como escolhido', () => {
        montar('crew_officer');

        expect(
            (screen.getByLabelText(t.crews.cargoDe('outro')) as HTMLSelectElement)
                .value,
        ).toBe('crew_officer');
    });

    it('avisa com o cargo escolhido', async () => {
        const aoEscolher = montar('crew_member');

        await userEvent.selectOptions(
            screen.getByLabelText(t.crews.cargoDe('outro')),
            'crew_leader',
        );

        expect(aoEscolher).toHaveBeenCalledWith('crew_leader');
    });

    /**
     * Escolher o que já lá está não é uma alteração. Sem isto, um
     * clique que não muda nada gastava um pedido e piscava a lista
     * inteira a recarregar.
     */
    it('não avisa quando o cargo escolhido é o que já lá estava', async () => {
        const aoEscolher = montar('crew_officer');

        await userEvent.selectOptions(
            screen.getByLabelText(t.crews.cargoDe('outro')),
            'crew_officer',
        );

        expect(aoEscolher).not.toHaveBeenCalled();
    });

    /**
     * Um cargo que a API devolveu e esta versão do ecrã não conhece.
     *
     * Sem o acrescentar à lista, o campo não encontrava o valor,
     * mostrava a primeira opção, e dizia que a pessoa é líder quando não
     * é. Mais vale mostrar o nome em bruto do que uma mentira legível.
     */
    it('mostra um cargo que ainda não conhece, em vez de fingir outro', () => {
        montar('crew_veteran');

        const campo = screen.getByLabelText(
            t.crews.cargoDe('outro'),
        ) as HTMLSelectElement;

        expect(campo.value).toBe('crew_veteran');
        expect(
            [...campo.querySelectorAll('option')].map((opcao) => opcao.value),
        ).toEqual([
            'crew_veteran',
            'crew_leader',
            'crew_officer',
            'crew_member',
        ]);
    });
});
