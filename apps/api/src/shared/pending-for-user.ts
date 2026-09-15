import {
    buildPermissionKey,
    DistributionStatus,
    entitlingSubscriptionFilter,
    MembershipStatus,
    TransactionStatus,
    type DatabaseClient,
} from '@vicehub/database';

/**
 * Uma coisa que está à espera desta pessoa, e onde ela vive.
 */
export interface PendingItem {
    kind:
    | 'crew_join_request'
    | 'server_join_request'
    | 'affiliation_request'
    | 'treasury_decision';
    /** A comunidade onde isto está à espera. */
    communityKind: 'crew' | 'server';
    communityId: string;
    communityName: string;
    /** Quantas coisas deste tipo estão lá à espera. */
    count: number;
}

/**
 * O que está à espera de mim, em toda a plataforma.
 *
 * Existe porque **saber o que falta era uma caminhada**. Os pedidos de
 * entrada vivem na página de cada crew, os de filiação na de cada
 * servidor, e as decisões de dinheiro na tesouraria de cada um: quem
 * gere três crews e um servidor tinha quatro páginas para ir espreitar,
 * repetidamente e para sempre. E quem está do outro lado — à espera de
 * uma resposta — não tinha sítio nenhum onde a esperar.
 *
 * É uma **vista** dos factos que já existem, como o feed de atividade e
 * pela mesma razão: uma segunda cópia acabaria por dizer o que a origem
 * já não diz, e uma caixa de entrada a apontar para pedidos que já
 * foram respondidos é pior do que caixa nenhuma.
 *
 * **Só aparece aqui o que esta pessoa pode mesmo fazer.** Contar os
 * pedidos de uma crew a quem não os pode aceitar não seria só um botão
 * inútil: seria contar-lhe quantas pessoas se andam a candidatar a uma
 * crew onde ela não manda.
 */
export interface PendingForUser {
    items: PendingItem[];
    /** Pedidos de amizade recebidos e ainda por responder. */
    friendRequests: number;
    /** A soma de tudo, que é o que o ecrã mostra no sino. */
    total: number;
}

/**
 * Em que comunidades é que esta pessoa tem cada poder.
 *
 * Lido de uma vez para todas as comunidades, e não uma consulta por
 * cada: quem gere várias pagaria uma ida à base de dados por cada uma
 * só para desenhar um número.
 */
const ondePode = async (
    database: DatabaseClient,
    userId: string,
): Promise<Map<string, Set<string>>> => {
    const cargos = await database.userRole.findMany({
        where: { userId, is_deleted: false },
        select: {
            crewId: true,
            serverId: true,
            role: {
                select: {
                    rolePermissions: {
                        where: { is_deleted: false },
                        select: {
                            permission: { select: { scope: true, slug: true } },
                        },
                    },
                },
            },
        },
    });

    const poderes = new Map<string, Set<string>>();

    for (const cargo of cargos) {
        /**
         * A chave leva o tipo à frente do identificador. São uuids e não
         * colidiriam, mas uma chave que diz o que é poupa quem lê de ter
         * de adivinhar o que está do outro lado do mapa.
         */
        const chave =
            cargo.crewId !== null
                ? `crew:${cargo.crewId}`
                : cargo.serverId !== null
                    ? `server:${cargo.serverId}`
                    : null;

        if (chave === null) {
            continue;
        }

        const conjunto = poderes.get(chave) ?? new Set<string>();

        for (const ligacao of cargo.role.rolePermissions) {
            /**
             * A chave é composta pelo mesmo auxiliar que o guard das
             * rotas usa. Compô-la à mão aqui era ter duas maneiras de
             * escrever a mesma permissão, e a segunda a divergir da
             * primeira no dia em que o formato mudasse — o que se
             * revelou já: o `slug` gravado é só a ação, e o recurso vem
             * do `scope`.
             */
            conjunto.add(
                buildPermissionKey(
                    ligacao.permission.scope,
                    ligacao.permission.slug,
                ),
            );
        }

        poderes.set(chave, conjunto);
    }

    return poderes;
};

/** As comunidades onde esta pessoa tem este poder. */
const comEstePoder = (
    poderes: Map<string, Set<string>>,
    tipo: 'crew' | 'server',
    permissao: string,
): string[] =>
    [...poderes.entries()]
        .filter(
            ([chave, conjunto]) =>
                chave.startsWith(`${tipo}:`) && conjunto.has(permissao),
        )
        .map(([chave]) => chave.slice(tipo.length + 1));

export const buildPendingForUser = async (
    database: DatabaseClient,
    userId: string,
    agora: Date = new Date(),
): Promise<PendingForUser> => {
    const poderes = await ondePode(database, userId);

    const crewsQueGere = comEstePoder(poderes, 'crew', 'crew:manage_members');
    const servidoresQueGere = comEstePoder(
        poderes,
        'server',
        'server:manage_members',
    );
    const servidoresQueControla = comEstePoder(poderes, 'server', 'server:manage');

    /**
     * Mexer no dinheiro exige plano, e por isso decidir também exige.
     *
     * Sem esta condição, a caixa de entrada oferecia uma decisão que a
     * API recusa — e a pessoa ia lá três vezes antes de perceber que o
     * que faltava era o plano, e não ela.
     */
    const podeDecidirDinheiro = [
        ...comEstePoder(poderes, 'crew', 'treasury:approve').map(
            (id) => ({ kind: 'crew' as const, id }),
        ),
        ...comEstePoder(poderes, 'server', 'treasury:approve').map(
            (id) => ({ kind: 'server' as const, id }),
        ),
    ];

    const [
        pedidosDeCrew,
        pedidosDeServidor,
        filiacoes,
        comPlano,
        amizades,
    ] = await Promise.all([
        contarPorComunidade(database, 'crew', crewsQueGere),
        contarPorComunidade(database, 'server', servidoresQueGere),
        contarFiliacoes(database, servidoresQueControla),
        comunidadesComPlano(database, podeDecidirDinheiro, agora),
        database.friendship.count({
            where: {
                is_deleted: false,
                status: MembershipStatus.pending,
                /**
                 * Só os que chegaram. Os que eu mandei estão à espera da
                 * outra pessoa, e contá-los aqui era pôr-me a mim na
                 * lista do que falta fazer.
                 */
                requested_by: { not: userId },
                OR: [{ userAId: userId }, { userBId: userId }],
            },
        }),
    ]);

    const decisoes = await contarDecisoes(database, comPlano);

    const items = [
        ...pedidosDeCrew,
        ...pedidosDeServidor,
        ...filiacoes,
        ...decisoes,
    ].filter((item) => item.count > 0);

    return {
        items,
        friendRequests: amizades,
        total:
            items.reduce((soma, item) => soma + item.count, 0) + amizades,
    };
};

/**
 * Quantos pedidos de entrada estão à espera em cada comunidade.
 *
 * Uma consulta agrupada, e não uma por comunidade: quem gere cinco
 * crews não deve pagar cinco idas à base de dados para ver um número.
 */
const contarPorComunidade = async (
    database: DatabaseClient,
    tipo: 'crew' | 'server',
    ids: string[],
): Promise<PendingItem[]> => {
    if (ids.length === 0) {
        return [];
    }

    const coluna = tipo === 'crew' ? 'crewId' : 'serverId';

    const grupos = await database.membership.groupBy({
        by: [coluna],
        where: {
            [coluna]: { in: ids },
            status: MembershipStatus.pending,
            is_deleted: false,
        },
        _count: { _all: true },
    });

    const nomes = await nomesDas(database, tipo, ids);

    return grupos.flatMap((grupo) => {
        const id = (grupo as unknown as Record<string, string | null>)[coluna];
        const nome = id === null || id === undefined ? undefined : nomes.get(id);

        /**
         * Uma comunidade apagada não entra: o cargo fica para trás
         * quando ela desaparece, e contar pedidos de uma crew que já não
         * existe mandava a pessoa para uma página que dá 404.
         */
        return nome === undefined || id === null || id === undefined
            ? []
            : [
                {
                    kind:
                        tipo === 'crew'
                            ? ('crew_join_request' as const)
                            : ('server_join_request' as const),
                    communityKind: tipo,
                    communityId: id,
                    communityName: nome,
                    count: grupo._count._all,
                },
            ];
    });
};

/**
 * Quantas crews estão à espera de poder jogar em cada servidor.
 */
const contarFiliacoes = async (
    database: DatabaseClient,
    serverIds: string[],
): Promise<PendingItem[]> => {
    if (serverIds.length === 0) {
        return [];
    }

    const grupos = await database.affiliation.groupBy({
        by: ['serverId'],
        where: {
            serverId: { in: serverIds },
            status: MembershipStatus.pending,
            is_deleted: false,
        },
        _count: { _all: true },
    });

    const nomes = await nomesDas(database, 'server', serverIds);

    return grupos.flatMap((grupo) => {
        const nome = nomes.get(grupo.serverId);

        return nome === undefined
            ? []
            : [
                {
                    kind: 'affiliation_request' as const,
                    communityKind: 'server' as const,
                    communityId: grupo.serverId,
                    communityName: nome,
                    count: grupo._count._all,
                },
            ];
    });
};

/**
 * Das comunidades onde posso decidir dinheiro, as que têm plano.
 *
 * Sem plano não se aprova nada — a tesouraria recusa —, e por isso
 * contá-las era anunciar trabalho que não se pode fazer.
 */
const comunidadesComPlano = async (
    database: DatabaseClient,
    comunidades: { kind: 'crew' | 'server'; id: string }[],
    agora: Date,
): Promise<{ kind: 'crew' | 'server'; id: string }[]> => {
    if (comunidades.length === 0) {
        return [];
    }

    const planos = await database.subscription.findMany({
        where: {
            ...entitlingSubscriptionFilter(agora),
            OR: [
                {
                    crewId: {
                        in: comunidades
                            .filter((c) => c.kind === 'crew')
                            .map((c) => c.id),
                    },
                },
                {
                    serverId: {
                        in: comunidades
                            .filter((c) => c.kind === 'server')
                            .map((c) => c.id),
                    },
                },
            ],
        },
        select: { crewId: true, serverId: true },
    });

    const cobertas = new Set(
        planos.map((plano) =>
            plano.crewId !== null
                ? `crew:${plano.crewId}`
                : `server:${plano.serverId ?? ''}`,
        ),
    );

    return comunidades.filter((c) => cobertas.has(`${c.kind}:${c.id}`));
};

/**
 * Quantas decisões de dinheiro estão à espera em cada comunidade.
 *
 * Movimentos e divisões contam juntos: para quem tem de decidir são a
 * mesma coisa — dinheiro parado à espera de um sim ou de um não.
 */
const contarDecisoes = async (
    database: DatabaseClient,
    comunidades: { kind: 'crew' | 'server'; id: string }[],
): Promise<PendingItem[]> => {
    if (comunidades.length === 0) {
        return [];
    }

    const carteiraDe = (c: { kind: 'crew' | 'server'; id: string }) =>
        c.kind === 'crew' ? { crewId: c.id } : { serverId: c.id };

    const contagens = await Promise.all(
        comunidades.map(async (comunidade) => {
            const [movimentos, divisoes] = await Promise.all([
                database.transaction.count({
                    where: {
                        wallet: carteiraDe(comunidade),
                        status: TransactionStatus.pending,
                        is_deleted: false,
                    },
                }),
                database.distribution.count({
                    where: {
                        wallet: carteiraDe(comunidade),
                        status: DistributionStatus.pending,
                        is_deleted: false,
                    },
                }),
            ]);

            return { comunidade, count: movimentos + divisoes };
        }),
    );

    const nomesDeCrews = await nomesDas(
        database,
        'crew',
        comunidades.filter((c) => c.kind === 'crew').map((c) => c.id),
    );
    const nomesDeServidores = await nomesDas(
        database,
        'server',
        comunidades.filter((c) => c.kind === 'server').map((c) => c.id),
    );

    return contagens.flatMap(({ comunidade, count }) => {
        const nome =
            comunidade.kind === 'crew'
                ? nomesDeCrews.get(comunidade.id)
                : nomesDeServidores.get(comunidade.id);

        return nome === undefined
            ? []
            : [
                {
                    kind: 'treasury_decision' as const,
                    communityKind: comunidade.kind,
                    communityId: comunidade.id,
                    communityName: nome,
                    count,
                },
            ];
    });
};

/**
 * Os nomes das comunidades que ainda existem.
 *
 * As apagadas ficam de fora, e é isso que faz a caixa de entrada nunca
 * apontar para uma página que já não abre.
 */
const nomesDas = async (
    database: DatabaseClient,
    tipo: 'crew' | 'server',
    ids: string[],
): Promise<Map<string, string>> => {
    if (ids.length === 0) {
        return new Map();
    }

    const linhas =
        tipo === 'crew'
            ? await database.crew.findMany({
                where: { id: { in: ids }, is_deleted: false },
                select: { id: true, name: true },
            })
            : await database.server.findMany({
                where: { id: { in: ids }, is_deleted: false },
                select: { id: true, name: true },
            });

    return new Map(linhas.map((linha) => [linha.id, linha.name]));
};
