import { buildPermissionKey, type DatabaseClient } from '@vicehub/database';

import type { AuthorizationScope } from '../types/authorization.types.js';

/**
 * Quanto tempo é que o catálogo de cargos vale sem se voltar a ler.
 *
 * Que permissões tem cada cargo é uma decisão de código: vive em
 * `rbac.ts`, e as linhas da base são um espelho que o `db:seed` grava.
 * Muda com um deploy, e um deploy reinicia o processo — por isso o
 * cache podia, em rigor, durar para sempre.
 *
 * Um minuto, e não para sempre, por causa do caso que fica de fora:
 * alguém a mexer nas linhas com a aplicação de pé. Assim uma mudança
 * dessas entra sozinha dentro de um minuto, em vez de esperar por um
 * reinício que ninguém se lembra de fazer.
 */
const CATALOGO_VALE_MS = 60_000;

/**
 * Que permissões tem cada cargo, prontas a comparar.
 *
 * Fora da classe, e não num campo dela: há mais do que um sítio a
 * construir este repositório, e um cache por instância seria o mesmo
 * trabalho feito três vezes.
 */
let catalogo: Map<string, Set<string>> | null = null;
let catalogoAte = 0;

/**
 * Os cargos que já se procuraram e não existem.
 *
 * Um cargo apagado sai do catálogo, mas as atribuições dele não
 * desaparecem com ele: quem o tivesse continua a trazer um
 * identificador que uma leitura fresca também não vai encontrar. Sem
 * esta lista, essa pessoa sozinha punha a aplicação a reler o catálogo
 * **em cada pedido** — o contrário exacto do que isto veio fazer.
 *
 * Nunca se limpa, e não precisa: só entram aqui identificadores que a
 * base já deu, e um cargo que volte a existir volta ao catálogo na
 * releitura seguinte — estar nesta lista não esconde um cargo que lá
 * esteja.
 */
let ausentes = new Set<string>();

/** Esquece o catálogo. Existe para os testes, que não esperam um minuto. */
export const esquecerCatalogoDeCargos = (): void => {
    catalogo = null;
    catalogoAte = 0;
    ausentes = new Set();
};

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
     * Que permissões dá cada cargo, do catálogo.
     *
     * Cargos, ligações e permissões eliminados ficam de fora — é aqui
     * que essa regra passou a viver, e não na leitura de cada pedido.
     *
     * Volta a ler quando o catálogo envelhece, e também quando lhe
     * pedem um cargo que ele não conhece: um cargo criado depois de o
     * processo arrancar não pode ficar sem permissões até alguém
     * reiniciar. Um identificador que uma leitura fresca também não
     * encontra fica marcado como ausente, ou quem tivesse um cargo
     * apagado mandava reler o catálogo em cada pedido.
     */
    async permissionsByRole(
        roleIds: readonly string[] = [],
    ): Promise<Map<string, Set<string>>> {
        const guardado = catalogo;

        const velho = guardado === null || Date.now() >= catalogoAte;

        const desconhecido =
            guardado !== null
            && roleIds.some(
                (roleId) => !guardado.has(roleId) && !ausentes.has(roleId),
            );

        if (!velho && !desconhecido) {
            return guardado;
        }

        const lido = await this.lerCatalogo();

        catalogo = lido;
        catalogoAte = Date.now() + CATALOGO_VALE_MS;

        /*
         * E o que continua a faltar depois de uma leitura fresca não
         * volta a mandar ler: não é um cargo novo, é um cargo que não
         * existe.
         */
        for (const roleId of roleIds) {
            if (!lido.has(roleId)) {
                ausentes.add(roleId);
            }
        }

        return lido;
    }

    private async lerCatalogo(): Promise<Map<string, Set<string>>> {
        const cargos = await this.database.role.findMany({
            where: { is_deleted: false },
            select: {
                id: true,
                rolePermissions: {
                    where: {
                        is_deleted: false,
                        permission: { is_deleted: false },
                    },
                    select: {
                        permission: { select: { slug: true, scope: true } },
                    },
                },
            },
        });

        return new Map(
            cargos.map((cargo) => [
                cargo.id,
                new Set(
                    /*
                     * Pelo mesmo auxiliar que o guard das rotas usa.
                     * Compor a chave à mão aqui era ter duas maneiras
                     * de escrever a mesma permissão, e a segunda a
                     * divergir da primeira no dia em que o formato
                     * mudasse.
                     */
                    cargo.rolePermissions.map((ligacao) =>
                        buildPermissionKey(
                            ligacao.permission.scope,
                            ligacao.permission.slug,
                        ),
                    ),
                ),
            ]),
        );
    }
}
