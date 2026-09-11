import {
    entitlingSubscriptionFilter,
    PAID_SUBSCRIPTION_STATUSES,
    type DatabaseClient,
} from '@vicehub/database';

/**
 * Uma comunidade que ficaria sem ninguém a mandar nela.
 */
export interface CommunityLeftBehind {
    kind: 'crew' | 'server';
    id: string;
    name: string;
}

/**
 * O que impede uma conta de ser apagada.
 *
 * São condições, e não avisos. Cada uma é uma coisa que ficaria
 * inalcançável — ou pior, a continuar a acontecer — depois de a pessoa
 * deixar de poder entrar para lhe mexer.
 */
export interface AccountDeletionBlockers {
    /**
     * Dinheiro parado na carteira da própria pessoa.
     *
     * A mesma regra das comunidades: apagar tornava-o inalcançável, e
     * quem o apagasse por engano não tinha como o reaver.
     */
    funds: bigint;

    /**
     * Comunidades onde esta pessoa é a única que manda.
     *
     * Apagar a conta deixava-as sem ninguém que as pudesse gerir,
     * apagar ou entregar — e as pessoas que lá estão ficavam presas a
     * uma comunidade que ninguém consegue mexer. Passar o cargo a
     * outra pessoa, ou apagar a comunidade, é o que desbloqueia.
     */
    orphanedCommunities: CommunityLeftBehind[];

    /**
     * Um plano **pago** em nome da própria pessoa, ainda a dar direito.
     *
     * Apagar a conta não cancela nada no Stripe: a cobrança continuava
     * a sair todos os meses de um cartão cujo dono já não tem forma de
     * a parar aqui. Cancelar primeiro é a única ordem honesta.
     *
     * Uma avaliação não conta — não foi paga —, e um vitalício também
     * não: é um presente, e trancar a saída por causa de um presente
     * transformava-o numa prisão.
     */
    hasActivePaidPlan: boolean;
}

export const blocksAccountDeletion = (
    blockers: AccountDeletionBlockers,
): boolean =>
    blockers.funds !== 0n
    || blockers.orphanedCommunities.length > 0
    || blockers.hasActivePaidPlan;

/**
 * Os cargos que, sozinhos, mandam numa comunidade.
 *
 * Não é qualquer cargo: um oficial de uma crew não a pode apagar nem
 * mudar, e portanto a saída dele não deixa ninguém preso. Estes dois
 * são os que podem, e por isso os únicos cuja ausência tranca a porta.
 */
const CARGOS_DE_DONO = ['crew_leader', 'server_owner'] as const;

/**
 * Lê de uma vez tudo o que pode impedir a eliminação da conta.
 */
export const findAccountDeletionBlockers = async (
    database: DatabaseClient,
    userId: string,
    agora: Date = new Date(),
): Promise<AccountDeletionBlockers> => {
    const [carteira, plano, cargos] = await Promise.all([
        database.wallet.findFirst({
            where: { userId, is_deleted: false },
            select: { balance: true },
        }),
        database.subscription.findFirst({
            where: {
                userId,
                ...entitlingSubscriptionFilter(agora),
                /**
                 * Substitui o `status` que o filtro traz. Os estados que
                 * dão acesso incluem a avaliação, e a pergunta aqui é
                 * outra: o que se procura é uma cobrança a sair.
                 */
                status: { in: [...PAID_SUBSCRIPTION_STATUSES] },
            },
            select: { id: true },
        }),
        database.userRole.findMany({
            where: {
                userId,
                is_deleted: false,
                role: { slug: { in: [...CARGOS_DE_DONO] } },
            },
            select: {
                crewId: true,
                serverId: true,
                crew: { select: { name: true, is_deleted: true } },
                server: { select: { name: true, is_deleted: true } },
            },
        }),
    ]);

    return {
        funds: carteira?.balance ?? 0n,
        hasActivePaidPlan: plano !== null,
        orphanedCommunities: await comunidadesSemOutroDono(
            database,
            userId,
            cargos,
        ),
    };
};

/**
 * Das comunidades onde esta pessoa manda, as que não têm mais ninguém.
 *
 * A pergunta é feita comunidade a comunidade e não de uma vez: são
 * poucas por pessoa — mandar em muitas é raro —, e a alternativa era
 * uma consulta agregada bem mais difícil de ler do que aquilo que ela
 * poupa.
 */
const comunidadesSemOutroDono = async (
    database: DatabaseClient,
    userId: string,
    cargos: {
        crewId: string | null;
        serverId: string | null;
        crew: { name: string; is_deleted: boolean } | null;
        server: { name: string; is_deleted: boolean } | null;
    }[],
): Promise<CommunityLeftBehind[]> => {
    const encontradas: CommunityLeftBehind[] = [];

    for (const cargo of cargos) {
        /**
         * Um cargo numa comunidade já apagada não prende ninguém. Não
         * são retirados quando a comunidade se apaga — o cargo fica
         * marcado como apagado com ela —, mas esta leitura não depende
         * disso para estar certa.
         */
        const alvo
            = cargo.crewId !== null && cargo.crew !== null && !cargo.crew.is_deleted
                ? ({ kind: 'crew', id: cargo.crewId, name: cargo.crew.name } as const)
                : cargo.serverId !== null
                    && cargo.server !== null
                    && !cargo.server.is_deleted
                    ? ({
                        kind: 'server',
                        id: cargo.serverId,
                        name: cargo.server.name,
                    } as const)
                    : null;

        if (alvo === null) {
            continue;
        }

        const outros = await database.userRole.count({
            where: {
                ...(alvo.kind === 'crew'
                    ? { crewId: alvo.id }
                    : { serverId: alvo.id }),
                is_deleted: false,
                role: { slug: { in: [...CARGOS_DE_DONO] } },
                /**
                 * Qualquer outra pessoa serve. Sem esta exclusão, a
                 * contagem encontrava-se a si própria e nenhuma
                 * comunidade parecia ficar sem dono.
                 */
                userId: { not: userId },
            },
        });

        if (outros === 0) {
            encontradas.push(alvo);
        }
    }

    return encontradas;
};

/**
 * Como fica o endereço de uma conta apagada.
 *
 * **Isto não é cosmético.** `email` e `username` são únicos na base de
 * dados, e essa unicidade não é filtrada por `is_deleted` como a das
 * crews: sem os trocar, o endereço e o nome ficavam presos para sempre
 * a uma conta que já não existe — e pior, `usernameTaken` dizia que o
 * nome estava livre e a gravação rebentava contra a chave única.
 *
 * O domínio é `.invalid`, que é reservado precisamente para isto e
 * garantidamente não entrega correio a ninguém.
 */
export const emailDeContaApagada = (userId: string): string =>
    `apagado+${userId}@vicehub.invalid`;

/**
 * O nome que fica no lugar de quem saiu.
 *
 * Curto de propósito: aparece ao lado de movimentos e de presenças em
 * eventos que continuam a existir, e um identificador comprido ali era
 * ruído. A parte do identificador chega para os distinguir uns dos
 * outros sem dizer nada sobre quem foram.
 */
export const usernameDeContaApagada = (userId: string): string =>
    `apagado-${userId.replaceAll('-', '').slice(0, 12)}`;

/**
 * Apaga a conta: leva o que é da pessoa, deixa o que é das comunidades.
 *
 * A linha que separa as duas coisas é esta: **o que identifica uma
 * pessoa sai; o que outras pessoas precisam para as contas baterem
 * certo fica.** Um movimento proposto, uma aprovação dada, uma presença
 * num evento por que outros foram pagos — nada disso é da pessoa que
 * saiu, é da crew, e apagá-lo deixava a tesouraria dela a não somar.
 * O que fica passa a estar em nome de uma lápide sem dados nenhuns.
 *
 * O registo de auditoria fica intocado, e fica de propósito: o esquema
 * não lhe põe sequer chave estrangeira para o utilizador, precisamente
 * para que apagar a conta não possa apagar o rasto.
 *
 * Vai tudo numa transação. A meio deste trabalho a conta está sem
 * identidades mas ainda com email, ou sem sessões mas ainda a aparecer
 * nas crews — e nenhum desses estados pode ficar gravado.
 */
export const eraseAccount = async (
    database: DatabaseClient,
    userId: string,
): Promise<void> => {
    const agora = new Date();

    const marca = {
        is_deleted: true,
        deleted_at: agora,
        updated_by: userId,
        version: { increment: 1 },
    };

    await database.$transaction([
        database.user.update({
            where: { id: userId },
            data: {
                email: emailDeContaApagada(userId),
                username: usernameDeContaApagada(userId),
                /**
                 * Tudo o que a pessoa escreveu sobre si. A cara, o texto,
                 * as cores: é isto que faz de um perfil o perfil de
                 * alguém.
                 */
                avatarUrl: null,
                bio: null,
                banner_url: null,
                accent_color: null,
                /**
                 * O endereço deixou de ser dela, portanto deixou de
                 * estar confirmado. Sem isto, a lápide ficava com um
                 * endereço `.invalid` marcado como verificado.
                 */
                email_verified_at: null,
                ...marca,
            },
        }),

        /**
         * A password e as identidades de fora são apagadas mesmo, e não
         * marcadas como apagadas.
         *
         * São as duas coisas cuja mera existência é um dado pessoal: um
         * hash de password é derivado de uma password que a pessoa
         * provavelmente usa noutro sítio, e uma identidade de Discord ou
         * de Google é o identificador dela num serviço que não é nosso.
         * Guardar qualquer um dos dois marcado como apagado seria dizer
         * que se apagou e não ter apagado.
         */
        database.userCredential.deleteMany({ where: { userId } }),
        database.userAuthProvider.deleteMany({ where: { userId } }),

        /**
         * Links de recuperação e de confirmação por usar. São chaves
         * para entrar numa conta, e a conta acabou.
         */
        database.accountToken.deleteMany({ where: { userId } }),

        /**
         * As sessões abertas, e os tokens que as renovam.
         *
         * Não é preciso mexer no `token_version` para matar os access
         * tokens já emitidos: quem os valida lê `is_deleted` do
         * utilizador **antes** de olhar para a versão, e a sessão a que
         * pertencem fica revogada aqui. Incrementá-lo também era
         * escrever uma linha que nenhum teste consegue distinguir da
         * sua ausência.
         */
        database.refreshToken.updateMany({
            where: { session: { userId }, revoked_at: null },
            data: { revoked_at: agora },
        }),
        database.authSession.updateMany({
            where: { userId, is_deleted: false },
            data: { ...marca, status: 'revoked', revoked_at: agora },
        }),

        /**
         * Sai de todas as comunidades e larga todos os cargos. As que
         * ficariam sem ninguém a mandar já impediram esta operação de
         * chegar aqui.
         */
        database.membership.updateMany({
            where: { userId, is_deleted: false },
            data: marca,
        }),
        database.userRole.updateMany({
            where: { userId, is_deleted: false },
            data: marca,
        }),

        /**
         * As amizades têm duas pontas e a outra é de outra pessoa. Ficar
         * com um amigo chamado "apagado-…" na lista é pior do que deixar
         * de o ter lá.
         */
        database.friendship.updateMany({
            where: {
                OR: [{ userAId: userId }, { userBId: userId }],
                is_deleted: false,
            },
            data: marca,
        }),
    ]);
};
