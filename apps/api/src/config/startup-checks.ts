import { DEFAULT_USER_ROLE, ROLES, type DatabaseClient } from '@vicehub/database';

/**
 * O que a base de dados tem de ter para a plataforma servir para alguma
 * coisa, verificado ao arrancar em vez de ao primeiro pedido.
 *
 * Isto existe por causa de uma hora perdida.
 *
 * Quem clona o repositório, aplica as migrações e se esquece do
 * `db:seed` fica com uma base de dados que tem todas as tabelas e nenhum
 * cargo. Tudo arranca. O diretório responde, a página abre, e o primeiro
 * registo devolve **500 sem explicação nenhuma** — porque criar uma
 * conta precisa do cargo base, e o cargo base não existe.
 *
 * O código já sabia disto e até dizia "corre npm run db:seed" — numa
 * exceção que morria no tratamento de erros e nunca chegava a ninguém.
 * Saber a resposta e não a dizer é pior do que não saber.
 *
 * Agora a pergunta é feita uma vez, ao arrancar, antes de haver quem
 * possa tropeçar nela.
 */
export interface ProblemaDeArranque {
    o_que: string;
    como_resolver: string;
}

/**
 * Confirma que o seed correu.
 *
 * A pergunta é feita ao cargo base e não à contagem de cargos: uma
 * contagem maior que zero passaria com um seed antigo a que faltasse
 * precisamente este, e é este que o registo precisa.
 */
export const verificarBaseDeDados = async (
    database: DatabaseClient,
): Promise<ProblemaDeArranque[]> => {
    const base = ROLES[DEFAULT_USER_ROLE];

    const cargo = await database.role.findFirst({
        where: { slug: base.slug, scope: base.scope, is_deleted: false },
        select: { id: true },
    });

    if (cargo) {
        return [];
    }

    return [
        {
            o_que: `O cargo base "${base.slug}" não existe na base de dados, e sem ele ninguém consegue criar conta.`,
            como_resolver: 'npm run db:seed',
        },
    ];
};

/**
 * Escreve os problemas de forma a que se leia sem procurar.
 *
 * Quem vê isto está a arrancar o projeto pela primeira vez e não conhece
 * o código. A mensagem tem de dizer o que falta e o comando exato — não
 * um nome de tabela e um stack trace.
 */
export const descreverProblemas = (problemas: ProblemaDeArranque[]): string =>
    [
        'A base de dados não está pronta:',
        '',
        ...problemas.flatMap((problema) => [
            `  ${problema.o_que}`,
            `  Resolve com:  ${problema.como_resolver}`,
            '',
        ]),
    ].join('\n');
