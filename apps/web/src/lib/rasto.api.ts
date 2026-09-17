import { api } from './api.js';

/**
 * Uma entrada do rasto de decisões de uma comunidade.
 *
 * `before` e `after` chegam como JSON solto porque é isso que são: o
 * estado que foi gravado no momento, sem forma fixa. Quem os lê trata-os
 * com desconfiança — uma entrada gravada por uma versão anterior pode
 * não ter os campos que a de hoje tem.
 */
export interface EntradaDoRasto {
    id: string;
    action: string;
    actorId: string | null;
    /** Null quando quem fez já apagou a conta. O rasto fica na mesma. */
    actorUsername: string | null;
    before: unknown;
    after: unknown;
    at: string;
}

export const listarRasto = (
    base: '/crews' | '/servers',
    id: string,
): Promise<EntradaDoRasto[]> =>
    api<EntradaDoRasto[]>(`${base}/${encodeURIComponent(id)}/history`);
