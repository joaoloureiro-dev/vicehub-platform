import {
    DistributionStatus,
    entitlingSubscriptionFilter,
    MembershipStatus,
    TransactionStatus,
    type DatabaseClient,
} from '@vicehub/database';

import { permissoesPorCargo } from './catalogo-de-cargos.js';

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

    /**
     * Candidaturas minhas que já foram respondidas e que eu ainda não
     * fui ver.
     *
     * É o outro lado desta caixa. Tudo o resto aqui é trabalho meu — há
     * alguém à espera de mim. Isto é o contrário: **eu** estive à espera
     * e a resposta já chegou. Sem isto, candidatar-se era um sítio sem
     * volta: quem foi aceite não sabia que já podia entrar, e quem foi
     * recusado continuava à espera de uma resposta que já lá estava.
     */
    answers: number;

    /**
     * Quando esta pessoa foi ver as respostas pela última vez.
     *
     * Vai para o ecrã para que ele possa marcar as que são novas sem
     * pedir nada outra vez: a página das comunidades já traz o
     * `respondedAt` de cada candidatura, e comparar as duas datas é
     * tudo o que é preciso. `null` é quem nunca lá foi.
     */
    answersSeenAt: string | null;

    /** A soma de tudo, que é o que o ecrã mostra no sino. */
    total: number;
}

/**
 * O mesmo, antes de se lhe saber o nome.
 *
 * Quem conta não vai à procura do nome da comunidade, e é por isso que
 * o nome de cada crew e de cada servidor se lê **uma vez** por pedido:
 * as quatro contagens pediam-nos cada uma por si, e as mesmas crews e
 * os mesmos servidores vinham da base duas e três vezes no mesmo
 * pedido. Contar e nomear são duas coisas, e esta caixa é lida em todos
 * os ecrãs.
 */
type Contagem = Omit<PendingItem, 'communityName'>;

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
    agora: Date,
): Promise<Map<string, Set<string>>> => {
    /*
     * Só as atribuições, e o que cada cargo dá vem do catálogo.
     *
     * Pedidas juntas — as permissões aninhadas dentro da atribuição —,
     * o Prisma partia a leitura em quatro instruções: as atribuições,
     * os cargos, as ligações e as permissões. **Quatro em cada pedido,
     * e esta caixa é lida em todos os ecrãs**, porque a casca mostra o
     * número. O catálogo já estava a ser guardado para o guard das
     * rotas; faltava esta leitura passar a usá-lo.
     */
    const cargos = await database.userRole.findMany({
        where: {
            userId,
            is_deleted: false,
            /**
             * E as que já passaram do prazo não contam.
             *
             * O guard das rotas sempre as ignorou; esta leitura não, e
             * a diferença era uma caixa a oferecer trabalho que a API
             * recusa — o mesmo erro que a condição do plano, mais
             * abaixo, existe para não ter. Hoje nada grava prazo num
             * cargo, e por isso ninguém deu por isto; no dia em que
             * alguém der um cargo temporário, dava.
             */
            OR: [{ expires_at: null }, { expires_at: { gt: agora } }],
        },
        select: { crewId: true, serverId: true, roleId: true },
    });

    const doCargo = await permissoesPorCargo(
        database,
        cargos.map((cargo) => cargo.roleId),
    );

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

        /*
         * As chaves vêm compostas pelo catálogo, com o mesmo auxiliar
         * que o guard das rotas usa. Compô-las aqui era ter duas
         * maneiras de escrever a mesma permissão, e a segunda a divergir
         * da primeira no dia em que o formato mudasse — o que se revelou
         * já: o `slug` gravado é só a ação, e o recurso vem do `scope`.
         *
         * Um cargo que o catálogo não conheça — apagado — não dá
         * poder nenhum, que é a regra que este ficheiro escrevia ao
         * contrário: a leitura antiga não excluía cargos apagados e
         * contava os pedidos de uma crew a quem já não manda nela.
         */
        for (const permissao of doCargo.get(cargo.roleId) ?? []) {
            conjunto.add(permissao);
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
    /**
     * Quando fui ver as respostas, e onde é que eu posso — ao mesmo
     * tempo.
     *
     * Estavam em série, uma à espera da outra, e não dependem uma da
     * outra para nada: a data é a minha e os poderes são os meus. Numa
     * caixa que a casca lê em todos os ecrãs, uma ida à base de dados
     * esperada por nada é meia ida a mais em cada página.
     *
     * Uma conta que já não exista não tem nada por ver — e chegar aqui
     * sem conta não devia acontecer, mas responder zero é melhor do que
     * rebentar uma caixa de entrada inteira por causa disso.
     */
    const [dono, poderes] = await Promise.all([
        database.user.findFirst({
            where: { id: userId, is_deleted: false },
            select: { answers_seen_at: true },
        }),
        ondePode(database, userId, agora),
    ]);

    const visto = dono?.answers_seen_at ?? null;

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

    /**
     * Os nomes, lidos uma vez para todas as comunidades que podem
     * aparecer nesta caixa.
     *
     * As quatro contagens pediam-nos cada uma por si, e as mesmas
     * crews e os mesmos servidores chegavam da base duas e três vezes
     * no mesmo pedido — que é lido em **todos** os ecrãs. Aqui é a
     * união de tudo o que esta pessoa gere ou onde decide dinheiro:
     * uma consulta por espécie, e as contagens só trazem números.
     *
     * A união é uma união de propósito, e hoje não acrescenta nada: os
     * cargos que existem dão `treasury:approve` só a quem já gere
     * membros, e `server:manage` só a quem já os gere também. Escrita
     * como o primeiro termo apenas, ficava certa por coincidência do
     * catálogo de cargos — e um cargo novo de tesouraria fazia
     * desaparecer da caixa, sem nome e sem queixa, as decisões que ele
     * concede.
     */
    const crewsPossiveis = [
        ...crewsQueGere,
        ...podeDecidirDinheiro.filter((c) => c.kind === 'crew').map((c) => c.id),
    ];

    const servidoresPossiveis = [
        ...servidoresQueGere,
        ...servidoresQueControla,
        ...podeDecidirDinheiro
            .filter((c) => c.kind === 'server')
            .map((c) => c.id),
    ];

    const [
        nomesDeCrews,
        nomesDeServidores,
        pedidos,
        filiacoes,
        comPlano,
        carteiras,
        amizades,
        respostas,
    ] = await Promise.all([
        nomesDas(database, 'crew', [...new Set(crewsPossiveis)]),
        nomesDas(database, 'server', [...new Set(servidoresPossiveis)]),
        contarPorComunidade(database, crewsQueGere, servidoresQueGere),
        contarFiliacoes(database, servidoresQueControla),
        comunidadesComPlano(database, podeDecidirDinheiro, agora),

        /*
         * As carteiras aqui, e não depois de se saber quais têm plano.
         *
         * Dependiam do plano só para encurtar a lista do `IN`, e por
         * isso esperavam por ele: eram três idas à base em fila —
         * planos, carteiras, e só então as contagens. Lidas de uma vez
         * com tudo o resto, a fila fica em duas, e quem não tem plano
         * não paga por isso nada: a carteira dele é lida, mas não
         * chega às contagens.
         */
        carteirasDe(database, podeDecidirDinheiro),

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
        contarRespostas(database, userId, visto),
    ]);

    const decisoes = await contarDecisoes(database, comPlano, carteiras);

    /**
     * E o nome de cada uma, num sítio só.
     *
     * Uma comunidade apagada fica sem nome e cai aqui — o cargo fica
     * para trás quando ela desaparece, e contar pedidos de uma crew que
     * já não existe mandava a pessoa para uma página que dá 404. A
     * regra estava escrita três vezes, uma por contagem; está escrita
     * uma.
     */
    const comNome = (contagem: Contagem): PendingItem[] => {
        const nome =
            contagem.communityKind === 'crew'
                ? nomesDeCrews.get(contagem.communityId)
                : nomesDeServidores.get(contagem.communityId);

        return nome === undefined
            ? []
            : [{ ...contagem, communityName: nome }];
    };

    const items = [
        ...pedidos,
        ...filiacoes,
        ...decisoes,
    ]
        .filter((contagem) => contagem.count > 0)
        .flatMap(comNome);

    return {
        items,
        friendRequests: amizades,
        answers: respostas,
        answersSeenAt: visto === null ? null : visto.toISOString(),
        total:
            items.reduce((soma, item) => soma + item.count, 0)
            + amizades
            + respostas,
    };
};

/**
 * Quantas respostas às minhas candidaturas chegaram desde a última vez
 * que fui ver.
 *
 * Conta as duas espécies de comunidade de uma vez. Uma candidatura
 * conta se **já foi respondida** e se essa resposta é posterior ao
 * momento em que olhei — quem nunca olhou tem todas por ver, que é o
 * que faz sentido para quem acaba de descobrir que isto existe.
 *
 * As comunidades apagadas ficam de fora, pela mesma razão que ficam no
 * resto desta caixa: contá-las mandava a pessoa a uma página que já não
 * abre.
 */
const contarRespostas = async (
    database: DatabaseClient,
    userId: string,
    visto: Date | null,
): Promise<number> => {
    const respondidasDepois = {
        userId,
        is_deleted: false,
        /**
         * `responded_at` é o que distingue uma candidatura respondida de
         * uma à espera, e existe nos dois desfechos: quem entrou e quem
         * levou não.
         */
        responded_at: visto === null ? { not: null } : { gt: visto },
        /**
         * Uma resposta que dei a mim próprio não é novidade nenhuma.
         *
         * Quem funda uma crew entra nela com a adesão já respondida, e
         * respondida por si: sem esta linha, criar uma crew dava logo
         * um "entraste" ao lado de "as minhas", a dizer a quem acabou
         * de a fundar aquilo que ele próprio acabou de fazer.
         *
         * É a mesma regra que os pedidos de amizade aqui ao lado já
         * seguem: o que eu fiz não me espera a mim.
         */
        responded_by: { not: userId },
    };

    /*
     * Uma contagem, e não uma por espécie de comunidade.
     *
     * Eram duas — as crews e os servidores —, somadas a seguir. A
     * condição é a mesma nas duas e só muda a coluna que tem de estar
     * preenchida, por isso cabem num `OR`: uma adesão tem crew ou tem
     * servidor, nunca os dois, e o que se quer é a soma.
     *
     * Numa caixa lida em todos os ecrãs, meia consulta é meia consulta
     * por página.
     */
    return database.membership.count({
        where: {
            ...respondidasDepois,
            OR: [
                { crewId: { not: null }, crew: { is_deleted: false } },
                { serverId: { not: null }, server: { is_deleted: false } },
            ],
        },
    });
};

/**
 * Quantos pedidos de entrada estão à espera em cada comunidade.
 *
 * Uma consulta agrupada, e não uma por comunidade: quem gere cinco
 * crews não deve pagar cinco idas à base de dados para ver um número.
 *
 * **E uma para as duas espécies.** Eram duas consultas iguais, uma a
 * agrupar por crew e outra por servidor. Agrupar pelas duas colunas de
 * uma vez dá o mesmo: cada adesão tem uma delas preenchida e a outra
 * nula, e é a preenchida que diz de que comunidade se trata.
 */
const contarPorComunidade = async (
    database: DatabaseClient,
    crewIds: string[],
    serverIds: string[],
): Promise<Contagem[]> => {
    if (crewIds.length === 0 && serverIds.length === 0) {
        return [];
    }

    const grupos = await database.membership.groupBy({
        by: ['crewId', 'serverId'],
        where: {
            status: MembershipStatus.pending,
            is_deleted: false,
            OR: [
                { crewId: { in: crewIds } },
                { serverId: { in: serverIds } },
            ],
        },
        _count: { _all: true },
    });

    return grupos.flatMap((grupo): Contagem[] => {
        if (grupo.crewId !== null) {
            return [
                {
                    kind: 'crew_join_request' as const,
                    communityKind: 'crew' as const,
                    communityId: grupo.crewId,
                    count: grupo._count._all,
                },
            ];
        }

        if (grupo.serverId !== null) {
            return [
                {
                    kind: 'server_join_request' as const,
                    communityKind: 'server' as const,
                    communityId: grupo.serverId,
                    count: grupo._count._all,
                },
            ];
        }

        /* Sem crew nem servidor não é de comunidade nenhuma. */
        return [];
    });
};

/**
 * Quantas crews estão à espera de poder jogar em cada servidor.
 */
const contarFiliacoes = async (
    database: DatabaseClient,
    serverIds: string[],
): Promise<Contagem[]> => {
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

    return grupos.map((grupo) => ({
        kind: 'affiliation_request' as const,
        communityKind: 'server' as const,
        communityId: grupo.serverId,
        count: grupo._count._all,
    }));
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

    const cobertas = new Set(planos.map(chaveDe));

    return comunidades.filter((c) => cobertas.has(`${c.kind}:${c.id}`));
};

/**
 * A comunidade de uma carteira, ou de um plano, como chave.
 *
 * A ordem dos dois ramos não importa: uma carteira tem crew ou tem
 * servidor, nunca os dois. Experimentou-se trocá-los e a suite não deu
 * por isso — e é essa a razão, não uma falta de teste.
 */
const chaveDe = (linha: { crewId: string | null; serverId: string | null }): string =>
    linha.crewId !== null
        ? `crew:${linha.crewId}`
        : `server:${linha.serverId ?? ''}`;

/** A carteira de cada comunidade onde esta pessoa decide dinheiro. */
const carteirasDe = async (
    database: DatabaseClient,
    comunidades: { kind: 'crew' | 'server'; id: string }[],
): Promise<{ id: string; crewId: string | null; serverId: string | null }[]> => {
    if (comunidades.length === 0) {
        return [];
    }

    return database.wallet.findMany({
        where: {
            is_deleted: false,
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
        select: { id: true, crewId: true, serverId: true },
    });
};

/**
 * Quantas decisões de dinheiro estão à espera em cada comunidade.
 *
 * Movimentos e divisões contam juntos: para quem tem de decidir são a
 * mesma coisa — dinheiro parado à espera de um sim ou de um não.
 *
 * **Duas consultas, e não duas por comunidade.** Isto contava uma
 * comunidade de cada vez, e é a mesma regra que o resto deste ficheiro
 * já seguia e esta função não: quem gere oito comunidades pagava
 * dezasseis idas à base para desenhar um número. E o número aparece
 * **em todos os ecrãs** — a casca lê-o para o sino —, por isso o custo
 * não era de uma página, era de cada página.
 *
 * Medido: dez consultas para quem não gere nada, mais duas e meia por
 * comunidade. Com dezasseis comunidades eram cinquenta e uma, por cada
 * carregamento.
 *
 * O caminho é pela carteira: as carteiras chegam lidas de fora, e as
 * duas consultas agrupam por carteira o que está à espera. O preço
 * deixa de depender de quantas comunidades se gere.
 */
const contarDecisoes = async (
    database: DatabaseClient,
    comunidades: { kind: 'crew' | 'server'; id: string }[],
    todasAsCarteiras: { id: string; crewId: string | null; serverId: string | null }[],
): Promise<Contagem[]> => {
    if (comunidades.length === 0) {
        return [];
    }

    /*
     * Só as das comunidades que têm plano — para encurtar o `IN` das
     * duas consultas que vêm a seguir, e mais nada.
     *
     * **A regra do plano não se decide aqui.** Quem a garante é o
     * `map` no fim, que devolve uma linha por comunidade de
     * `comunidades` — e essas são só as que têm plano. Tirar este
     * filtro dava exactamente o mesmo resultado, com consultas
     * maiores; um mutante que o apagasse sobreviveu à suite, e
     * sobreviveu com razão. Fica escrito para ninguém ler aqui uma
     * defesa que não está aqui.
     */
    const comDireito = new Set(
        comunidades.map((comunidade) => `${comunidade.kind}:${comunidade.id}`),
    );

    const carteiras = todasAsCarteiras.filter((carteira) =>
        comDireito.has(chaveDe(carteira)));

    /** De que comunidade é cada carteira. */
    const daCarteira = new Map(
        carteiras.map((carteira) => [carteira.id, chaveDe(carteira)]),
    );

    const ids = carteiras.map((carteira) => carteira.id);

    const [movimentos, divisoes] = await Promise.all([
        database.transaction.groupBy({
            by: ['walletId'],
            where: {
                walletId: { in: ids },
                status: TransactionStatus.pending,
                is_deleted: false,
            },
            _count: { _all: true },
        }),
        database.distribution.groupBy({
            by: ['walletId'],
            where: {
                walletId: { in: ids },
                status: DistributionStatus.pending,
                is_deleted: false,
            },
            _count: { _all: true },
        }),
    ]);

    /** O que está à espera em cada comunidade, das duas espécies. */
    const aEsperar = new Map<string, number>();

    for (const grupo of [...movimentos, ...divisoes]) {
        const chave = daCarteira.get(grupo.walletId);

        if (chave !== undefined) {
            aEsperar.set(chave, (aEsperar.get(chave) ?? 0) + grupo._count._all);
        }
    }

    return comunidades.map((comunidade) => ({
        kind: 'treasury_decision' as const,
        communityKind: comunidade.kind,
        communityId: comunidade.id,
        count: aEsperar.get(`${comunidade.kind}:${comunidade.id}`) ?? 0,
    }));
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
