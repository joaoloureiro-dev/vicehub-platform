import { buildPermissionKey, type DatabaseClient } from '@vicehub/database';

/**
 * Que permissões dá cada cargo, lido uma vez e guardado.
 *
 * **Fora de qualquer classe, e num ficheiro só.** Há mais do que um
 * sítio a precisar disto — o guard das rotas, que corre em cada pedido
 * autenticado, e a caixa do que espera resposta, que a casca lê em
 * todos os ecrãs. Enquanto viveu dentro do repositório de autorização,
 * o segundo não o alcançava e fazia a sua própria leitura aninhada: o
 * Prisma partia-a em quatro instruções, e a caixa pagava-as em cada
 * pedido.
 *
 * Também é a resposta a «nunca duas maneiras de escrever a mesma
 * regra». Quem escrevia a sua própria leitura escrevia com ela a sua
 * própria versão do que conta — e ficou com uma diferente: lá, um
 * cargo apagado continuava a dar poderes, porque a condição que os
 * exclui vivia só aqui.
 */

/**
 * Quanto tempo é que o catálogo vale sem se voltar a ler.
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

const lerCatalogo = async (
    database: DatabaseClient,
): Promise<Map<string, Set<string>>> => {
    const cargos = await database.role.findMany({
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
                 * Pelo mesmo auxiliar que o guard das rotas usa. Compor
                 * a chave à mão aqui era ter duas maneiras de escrever a
                 * mesma permissão, e a segunda a divergir da primeira no
                 * dia em que o formato mudasse.
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
};

/**
 * Que permissões dá cada cargo.
 *
 * Cargos, ligações e permissões eliminados ficam de fora — é aqui que
 * essa regra vive, e não na leitura de cada pedido.
 *
 * Volta a ler quando o catálogo envelhece, e também quando lhe pedem um
 * cargo que ele não conhece: um cargo criado depois de o processo
 * arrancar não pode ficar sem permissões até alguém reiniciar. Um
 * identificador que uma leitura fresca também não encontra fica marcado
 * como ausente, ou quem tivesse um cargo apagado mandava reler o
 * catálogo em cada pedido.
 */
export const permissoesPorCargo = async (
    database: DatabaseClient,
    roleIds: readonly string[] = [],
): Promise<Map<string, Set<string>>> => {
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

    const lido = await lerCatalogo(database);

    catalogo = lido;
    catalogoAte = Date.now() + CATALOGO_VALE_MS;

    /*
     * E o que continua a faltar depois de uma leitura fresca não volta a
     * mandar ler: não é um cargo novo, é um cargo que não existe.
     */
    for (const roleId of roleIds) {
        if (!lido.has(roleId)) {
            ausentes.add(roleId);
        }
    }

    return lido;
};
