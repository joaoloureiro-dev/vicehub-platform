import {
    MembershipStatus,
    MembershipType,
    XpReason,
    type DatabaseClient,
} from '@vicehub/database';

const CREW_SELECT = { id: true, name: true, tag: true } as const;
const PESSOA_SELECT = { id: true, username: true } as const;

export class ActivityRepository {
    constructor(private readonly database: DatabaseClient) { }

    /** As crews a que pertenço agora. */
    async listMyCrewIds(userId: string): Promise<string[]> {
        const adesoes = await this.database.membership.findMany({
            where: {
                userId,
                type: MembershipType.crew,
                status: MembershipStatus.active,
                is_deleted: false,
            },
            select: { crewId: true },
        });

        return adesoes
            .map((adesao) => adesao.crewId)
            .filter((id): id is string => id !== null);
    }

    /**
     * Quem são os meus amigos.
     *
     * O par está ordenado na base, por isso o outro lado é o que não sou
     * eu — a mesma conta que o módulo das amizades faz.
     */
    async listMyFriendIds(userId: string): Promise<string[]> {
        const amizades = await this.database.friendship.findMany({
            where: {
                status: MembershipStatus.active,
                is_deleted: false,
                OR: [{ userAId: userId }, { userBId: userId }],
            },
            select: { userAId: true, userBId: true },
        });

        return amizades.map((amizade) =>
            amizade.userAId === userId ? amizade.userBId : amizade.userAId,
        );
    }

    /** Eventos concluídos que deram xp às minhas crews. */
    listCrewEvents(crewIds: string[], take: number) {
        return this.database.xpAward.findMany({
            where: {
                crewId: { in: crewIds },
                reason: XpReason.event_completed,
                is_deleted: false,
            },
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
            take,
            select: {
                id: true,
                amount: true,
                created_at: true,
                crew: { select: CREW_SELECT },
                event: { select: { id: true, name: true } },
            },
        });
    }

    /**
     * Adesões aceites, das crews indicadas ou das pessoas indicadas.
     *
     * Uma consulta para os dois casos porque é a mesma pergunta com um
     * filtro diferente — e porque assim a forma do que volta é a mesma,
     * e o serviço não precisa de dois caminhos para a ler.
     */
    listCrewJoins(
        filtro: { crewIds: string[] } | { userIds: string[] },
        take: number,
    ) {
        return this.database.membership.findMany({
            where: {
                type: MembershipType.crew,
                status: MembershipStatus.active,
                is_deleted: false,
                ...('crewIds' in filtro
                    ? { crewId: { in: filtro.crewIds } }
                    : { userId: { in: filtro.userIds } }),
            },
            orderBy: [
                { responded_at: 'desc' },
                { created_at: 'desc' },
                { id: 'desc' },
            ],
            take,
            select: {
                id: true,
                created_at: true,
                responded_at: true,
                crew: { select: CREW_SELECT },
                user: { select: PESSOA_SELECT },
            },
        });
    }
}
