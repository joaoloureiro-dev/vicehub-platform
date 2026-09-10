import { useParams } from 'react-router';

import type { Dono } from './event.api.js';

/**
 * De que comunidade são os eventos do ecrã que está aberto.
 *
 * Os ecrãs de eventos são os mesmos para crews e para servidores, tal
 * como as rotas da API: as regras não mudam, e escrever dois ecrãs faria
 * com que uma correção só entrasse num deles. É o parâmetro que vier
 * preenchido que decide — `/crews/:crewId/eventos` ou
 * `/servidores/:serverId/eventos`.
 *
 * As duas URLs também não são simétricas na escrita: a da API diz
 * `servers` e a do site diz `servidores`, porque uma é endereço de
 * máquina e a outra é endereço de pessoa. Ficam as duas aqui para que
 * nenhum ecrã tenha de se lembrar disso.
 */
export interface DonoDoEcra {
    /** O titular, como a API o quer. */
    dono: Dono;

    /** A página da comunidade. */
    comunidade: string;

    /** O calendário da comunidade. */
    calendario: string;
}

export const useDono = (): DonoDoEcra => {
    const { crewId, serverId } = useParams<{
        crewId?: string;
        serverId?: string;
    }>();

    if (serverId !== undefined) {
        return {
            dono: { tipo: 'servers', id: serverId },
            comunidade: `/servidores/${serverId}`,
            calendario: `/servidores/${serverId}/eventos`,
        };
    }

    /**
     * Sem servidor é crew. O identificador vem do caminho e o React
     * Router só monta o ecrã quando ele lá está, por isso não há aqui um
     * terceiro caso a tratar — se houvesse, seria uma rota mal
     * registada, e não um estado que um utilizador consiga produzir.
     */
    return {
        dono: { tipo: 'crews', id: crewId as string },
        comunidade: `/crews/${crewId}`,
        calendario: `/crews/${crewId}/eventos`,
    };
};
