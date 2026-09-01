import type { RoleKey } from './rbac.js';

/**
 * Pesos por omissão de uma divisão ponderada por cargo.
 *
 * Segue o que as comunidades de FiveM já fazem: no paycheck do QBCore o
 * salário vem do grau, e nos assaltos quem lidera leva uma fatia maior.
 *
 * Os pesos vivem aqui, e não espalhados pelo código, pela mesma razão do
 * catálogo de cargos e do de planos: quem recebe quanto é uma regra de
 * negócio, e uma regra de negócio tem um sítio só.
 *
 * São valores por omissão. Cada crew pode indicar os seus na proposta —
 * uma comunidade acha justo o dobro para o líder, outra o triplo, e essa
 * é uma decisão delas e não nossa.
 */
export const DEFAULT_ROLE_WEIGHTS = {
    crew_leader: 3,
    crew_officer: 2,
    crew_member: 1,
    server_owner: 3,
    server_moderator: 2,
    server_member: 1,
} as const satisfies Partial<Record<RoleKey, number>>;

export type WeightedRoleKey = keyof typeof DEFAULT_ROLE_WEIGHTS;

export const WEIGHTED_ROLE_KEYS = Object.keys(
    DEFAULT_ROLE_WEIGHTS,
) as WeightedRoleKey[];

/**
 * Peso de quem não tem cargo atribuído no âmbito.
 *
 * Pertencer já dá direito a parte: um membro sem cargo recebe como um
 * membro comum, e não zero. Zero seria excluir da divisão alguém que a
 * crew aceitou.
 */
export const WEIGHT_WITHOUT_ROLE = 1;

/**
 * Peso de um cargo, com o valor por omissão quando não é indicado.
 */
export const weightOfRole = (
    slug: string | null,
    overrides: Partial<Record<string, number | undefined>> = {},
): number => {
    if (slug === null) {
        return overrides['none'] ?? WEIGHT_WITHOUT_ROLE;
    }

    const indicado = overrides[slug];

    if (indicado !== undefined) {
        return indicado;
    }

    return (
        DEFAULT_ROLE_WEIGHTS[slug as WeightedRoleKey] ?? WEIGHT_WITHOUT_ROLE
    );
};
