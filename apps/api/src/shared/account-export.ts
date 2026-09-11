import type { DatabaseClient } from '@vicehub/database';

/**
 * Tudo o que a plataforma tem sobre uma pessoa, num objeto só.
 *
 * O outro lado de poder apagar a conta: **poder levá-la**. De pouco
 * serve a saída se sair custar perder tudo o que se fez — e uma
 * plataforma que só deixa sair de mãos vazias está a cobrar uma multa
 * por sair.
 *
 * Três regras decidem o que aqui entra:
 *
 * 1. **O que é sobre esta pessoa entra.** O perfil, as comunidades onde
 *    está, os eventos em que esteve, o que propôs e aprovou, o que a
 *    plataforma lhe deu.
 * 2. **O que é de outra pessoa não entra.** De quem está do outro lado
 *    de uma amizade vai o nome público e mais nada — o mesmo que
 *    qualquer pessoa vê ao abrir o perfil dela.
 * 3. **O que é uma chave não entra.** O hash da password, os tokens de
 *    sessão, os links de recuperação por usar: nada disso é informação
 *    sobre a pessoa, é a maneira de entrar na conta dela. Pô-los num
 *    ficheiro que vai parar aos Downloads seria transformar o direito
 *    de levar os dados numa forma de os perder.
 */
export interface AccountExport {
    /**
     * Quando foi feito. Uma exportação sem data não se distingue de
     * outra feita há um ano, e o que mudou entre as duas é o que mais
     * interessa a quem as compara.
     */
    exportedAt: string;
    /**
     * Que formato é este. Existe para que uma exportação guardada hoje
     * continue a poder ser lida quando o formato mudar.
     */
    format: 'vicehub.account.v1';

    account: {
        id: string;
        email: string;
        username: string;
        emailVerifiedAt: string | null;
        createdAt: string;
        lastLoginAt: string | null;
    };

    profile: {
        avatarUrl: string | null;
        bio: string | null;
        bannerUrl: string | null;
        accentColor: string | null;
        level: number;
        xp: string;
        reputation: number;
    };

    /**
     * Por onde esta conta entra, sem o que serve para entrar.
     *
     * O identificador lá do fornecedor vai, e deve ir: é um dado sobre
     * a pessoa, é dela, e é o que lhe permite reconhecer que conta de
     * Discord está ligada a esta. O que não vai é token nenhum.
     */
    signInMethods: {
        provider: string;
        providerEmail: string | null;
        linkedAt: string;
    }[];

    communities: {
        kind: 'crew' | 'server';
        id: string;
        name: string;
        status: string;
        joinedAt: string | null;
        roles: string[];
    }[];

    events: {
        id: string;
        name: string;
        status: string;
        startsAt: string;
        /** Se esteve, se desistiu, se faltou. */
        participation: string;
        /** Quanto valeu a presença na divisão dos ganhos. */
        weight: number;
    }[];

    /**
     * A carteira da própria pessoa e o que lá entrou e saiu.
     *
     * Os movimentos das crews **não** entram: o dinheiro é da crew, o
     * histórico é da crew, e quem lá está continua a vê-lo na
     * plataforma. O que entra é o que esta pessoa propôs ou decidiu,
     * porque isso é um ato dela.
     */
    wallet: {
        balance: string;
        movements: {
            id: string;
            amount: string;
            /** Se entrou ou saiu, e a que título. */
            direction: string;
            category: string;
            status: string;
            description: string | null;
            createdAt: string;
        }[];
    } | null;

    /** O que esta pessoa propôs ou decidiu na tesouraria de outros. */
    treasuryActions: {
        id: string;
        /** Se foi quem propôs o movimento ou quem o decidiu. */
        role: 'proposed' | 'decided';
        amount: string;
        direction: string;
        category: string;
        status: string;
        createdAt: string;
    }[];

    subscriptions: {
        plan: string;
        status: string;
        priceCents: number;
        currency: string;
        startedAt: string;
        endsAt: string | null;
    }[];

    achievements: { slug: string; earnedAt: string }[];

    /**
     * De quem está do outro lado vai o nome público e mais nada: é o
     * mesmo que qualquer pessoa vê ao abrir o perfil.
     */
    friends: { username: string; status: string; since: string }[];
}

/**
 * Junta tudo o que a plataforma tem sobre esta pessoa.
 *
 * As consultas correm todas ao mesmo tempo: são independentes umas das
 * outras, e encadeá-las multiplicava por dez o tempo de espera de uma
 * operação que já é a mais pesada que uma conta pode pedir.
 */
export const buildAccountExport = async (
    database: DatabaseClient,
    userId: string,
): Promise<AccountExport | null> => {
    /**
     * Os campos são escolhidos um a um, e não lidos em bloco.
     *
     * Uma leitura sem `select` traz a linha inteira, e a linha inteira
     * cresce: o dia em que a tabela ganhar uma coluna nova, ela entra
     * numa exportação que ninguém voltou a olhar. Escolher aqui obriga
     * quem acrescenta uma coluna a decidir de propósito se ela sai
     * daqui para fora.
     */
    const user = await database.user.findFirst({
        where: { id: userId, is_deleted: false },
        select: {
            id: true,
            email: true,
            username: true,
            email_verified_at: true,
            created_at: true,
            last_login_at: true,
            avatarUrl: true,
            bio: true,
            banner_url: true,
            accent_color: true,
            level: true,
            xp: true,
            reputation: true,
        },
    });

    if (!user) {
        return null;
    }

    const [
        identidades,
        filiacoes,
        cargos,
        participacoes,
        carteira,
        propostos,
        decididos,
        planos,
        conquistas,
        amizades,
    ] = await Promise.all([
        database.userAuthProvider.findMany({
            where: { userId, is_deleted: false },
            select: {
                provider: true,
                provider_email: true,
                created_at: true,
            },
        }),
        database.membership.findMany({
            where: { userId, is_deleted: false },
            select: {
                crewId: true,
                serverId: true,
                status: true,
                created_at: true,
                crew: { select: { name: true } },
                server: { select: { name: true } },
            },
        }),
        database.userRole.findMany({
            where: { userId, is_deleted: false },
            select: {
                crewId: true,
                serverId: true,
                role: { select: { slug: true } },
            },
        }),
        database.eventParticipant.findMany({
            where: { userId, is_deleted: false },
            select: {
                status: true,
                weight: true,
                event: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        starts_at: true,
                    },
                },
            },
            orderBy: { created_at: 'desc' },
        }),
        database.wallet.findFirst({
            where: { userId, is_deleted: false },
            select: {
                balance: true,
                transactions: {
                    where: { is_deleted: false },
                    select: {
                        id: true,
                        amount: true,
                        direction: true,
                        category: true,
                        status: true,
                        description: true,
                        created_at: true,
                    },
                    orderBy: { created_at: 'desc' },
                },
            },
        }),
        database.transaction.findMany({
            where: { requested_by: userId, is_deleted: false },
            select: {
                id: true,
                amount: true,
                direction: true,
                category: true,
                status: true,
                created_at: true,
            },
            orderBy: { created_at: 'desc' },
        }),
        database.transaction.findMany({
            where: { decided_by: userId, is_deleted: false },
            select: {
                id: true,
                amount: true,
                direction: true,
                category: true,
                status: true,
                created_at: true,
            },
            orderBy: { created_at: 'desc' },
        }),
        database.subscription.findMany({
            where: { userId, is_deleted: false },
            select: {
                plan: true,
                status: true,
                price_cents: true,
                currency: true,
                current_period_start: true,
                current_period_end: true,
            },
        }),
        database.achievement.findMany({
            where: { userId, is_deleted: false },
            select: { slug: true, earned_at: true },
        }),
        database.friendship.findMany({
            where: {
                OR: [{ userAId: userId }, { userBId: userId }],
                is_deleted: false,
            },
            select: {
                status: true,
                created_at: true,
                userAId: true,
                userA: { select: { username: true } },
                userB: { select: { username: true } },
            },
        }),
    ]);

    return {
        exportedAt: new Date().toISOString(),
        format: 'vicehub.account.v1',

        account: {
            id: user.id,
            email: user.email,
            username: user.username,
            emailVerifiedAt: user.email_verified_at?.toISOString() ?? null,
            createdAt: user.created_at.toISOString(),
            lastLoginAt: user.last_login_at?.toISOString() ?? null,
        },

        profile: {
            avatarUrl: user.avatarUrl,
            bio: user.bio,
            bannerUrl: user.banner_url,
            accentColor: user.accent_color,
            level: user.level,
            /**
             * Em texto, e não em número: o xp é um inteiro de 64 bits e
             * `JSON.stringify` não sabe escrever um. Um número grande
             * de mais perde dígitos em silêncio ao ser lido de volta.
             */
            xp: user.xp.toString(),
            reputation: user.reputation,
        },

        signInMethods: identidades.map((identidade) => ({
            provider: identidade.provider,
            providerEmail: identidade.provider_email,
            linkedAt: identidade.created_at.toISOString(),
        })),

        communities: filiacoes.map((filiacao) => {
            const ehCrew = filiacao.crewId !== null;

            return {
                kind: ehCrew ? ('crew' as const) : ('server' as const),
                id: (ehCrew ? filiacao.crewId : filiacao.serverId) ?? '',
                name:
                    (ehCrew ? filiacao.crew?.name : filiacao.server?.name) ?? '',
                status: filiacao.status,
                joinedAt: filiacao.created_at.toISOString(),
                roles: cargos
                    .filter((cargo) =>
                        ehCrew
                            ? cargo.crewId === filiacao.crewId
                            : cargo.serverId === filiacao.serverId,
                    )
                    .map((cargo) => cargo.role.slug),
            };
        }),

        events: participacoes.map((participacao) => ({
            id: participacao.event.id,
            name: participacao.event.name,
            status: participacao.event.status,
            startsAt: participacao.event.starts_at.toISOString(),
            participation: participacao.status,
            weight: participacao.weight,
        })),

        wallet:
            carteira === null
                ? null
                : {
                    balance: carteira.balance.toString(),
                    movements: carteira.transactions.map((movimento) => ({
                        id: movimento.id,
                        amount: movimento.amount.toString(),
                        direction: movimento.direction,
                        category: movimento.category,
                        status: movimento.status,
                        description: movimento.description,
                        createdAt: movimento.created_at.toISOString(),
                    })),
                },

        treasuryActions: [
            ...propostos.map((movimento) => ({
                ...movimentoExportado(movimento),
                role: 'proposed' as const,
            })),
            ...decididos.map((movimento) => ({
                ...movimentoExportado(movimento),
                role: 'decided' as const,
            })),
        ],

        subscriptions: planos.map((plano) => ({
            plan: plano.plan,
            status: plano.status,
            priceCents: plano.price_cents,
            currency: plano.currency,
            startedAt: plano.current_period_start.toISOString(),
            endsAt: plano.current_period_end?.toISOString() ?? null,
        })),

        achievements: conquistas.map((conquista) => ({
            slug: conquista.slug,
            earnedAt: conquista.earned_at.toISOString(),
        })),

        friends: amizades.map((amizade) => ({
            /**
             * O nome de quem está do outro lado. Qual dos dois lados é
             * decide-se comparando com quem pediu a exportação — a
             * tabela guarda o par ordenado e não sabe qual deles é
             * "o outro".
             */
            username:
                amizade.userAId === userId
                    ? amizade.userB.username
                    : amizade.userA.username,
            status: amizade.status,
            since: amizade.created_at.toISOString(),
        })),
    };
};

const movimentoExportado = (movimento: {
    id: string;
    amount: bigint;
    direction: string;
    category: string;
    status: string;
    created_at: Date;
}) => ({
    id: movimento.id,
    amount: movimento.amount.toString(),
    direction: movimento.direction,
    category: movimento.category,
    status: movimento.status,
    createdAt: movimento.created_at.toISOString(),
});
