import { type DatabaseClient } from '@vicehub/database';

import { permissoesPorCargo } from '../../../shared/catalogo-de-cargos.js';
import type { AuthorizationScope } from '../types/authorization.types.js';

/*
 * O catálogo mudou de casa: vive em `shared/catalogo-de-cargos.ts`,
 * porque a caixa do que espera resposta também precisa dele e o
 * alcance daqui não chegava lá. Continua a sair por este nome para
 * quem já o importava.
 */
export { esquecerCatalogoDeCargos } from '../../../shared/catalogo-de-cargos.js';

/**
 * Repositório do módulo de autorização.
 *
 * É a única camada que fala com a base de dados dentro do módulo.
 */
export class AuthorizationRepository {
    constructor(private readonly database: DatabaseClient) { }

    /**
     * Os cargos que este utilizador tem no âmbito indicado.
     *
     * **Uma instrução, e é essa a razão de existir separada do que cada
     * cargo dá.** Isto corre em cada pedido autenticado — e a casca faz
     * três por página, antes do conteúdo —, enquanto o que um cargo dá
     * muda com um deploy. Lidas juntas, o Prisma partia a leitura
     * aninhada em quatro instruções e a página pagava-as todas, três
     * vezes.
     *
     * São considerados os cargos globais e, quando o âmbito o indicar,
     * os cargos atribuídos a essa crew ou a esse servidor. Um cargo de
     * outra crew nunca conta para a crew em causa.
     *
     * Atribuições expiradas ou eliminadas são ignoradas. Cargos e
     * permissões eliminados também, mas noutro sítio: um cargo apagado
     * não entra no catálogo, e um identificador que o catálogo não
     * conhece não dá permissão nenhuma.
     */
    findGrantedRoleIds(userId: string, scope: AuthorizationScope) {
        const now = new Date();

        /**
         * Cargos globais: sem crew nem servidor associados.
         */
        const scopeConditions: {
            crewId: string | null;
            serverId: string | null;
        }[] = [{ crewId: null, serverId: null }];

        if (scope.crewId !== undefined) {
            scopeConditions.push({ crewId: scope.crewId, serverId: null });
        }

        if (scope.serverId !== undefined) {
            scopeConditions.push({ crewId: null, serverId: scope.serverId });
        }

        return this.database.userRole.findMany({
            where: {
                userId,
                is_deleted: false,
                OR: scopeConditions,
                AND: [
                    {
                        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
                    },
                ],
            },
            select: { roleId: true },
        });
    }

    /**
     * Que permissões dá cada cargo.
     *
     * Delega no catálogo, que é partilhado com quem mais precise dele.
     */
    permissionsByRole(
        roleIds: readonly string[] = [],
    ): Promise<Map<string, Set<string>>> {
        return permissoesPorCargo(this.database, roleIds);
    }
}
