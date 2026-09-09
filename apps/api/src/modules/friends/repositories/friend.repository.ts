import {
    MembershipStatus,
    SourceType,
    type DatabaseClient,
} from '@vicehub/database';

import { parOrdenado } from '../types/friend.types.js';

/** O que se mostra de quem está do outro lado. */
const PESSOA_SELECT = {
    id: true,
    username: true,
    avatarUrl: true,
    level: true,
    xp: true,
} as const;

const ABERTAS = [MembershipStatus.pending, MembershipStatus.active];

export class FriendRepository {
    constructor(private readonly database: DatabaseClient) { }

    findUser(userId: string) {
        return this.database.user.findFirst({
            where: { id: userId, is_deleted: false },
            select: { id: true },
        });
    }

    /**
     * A relação aberta entre duas pessoas, se existir.
     *
     * Uma só, porque o índice parcial não deixa haver duas. Recusadas e
     * desfeitas ficam gravadas mas não contam como abertas: dizer que
     * não hoje não fecha a porta para sempre.
     */
    findOpen(um: string, outro: string) {
        return this.database.friendship.findFirst({
            where: {
                ...parOrdenado(um, outro),
                status: { in: ABERTAS },
                is_deleted: false,
            },
        });
    }

    create(um: string, outro: string, requestedBy: string) {
        return this.database.friendship.create({
            data: {
                ...parOrdenado(um, outro),
                status: MembershipStatus.pending,
                requested_by: requestedBy,
                source: SourceType.api,
                created_by: requestedBy,
            },
        });
    }

    /**
     * Muda o estado de uma relação, se ela ainda estiver como se pensa.
     *
     * A condição vai na escrita e não antes dela: duas respostas ao
     * mesmo pedido no mesmo instante passariam as duas por uma
     * verificação em memória, e a segunda escreveria por cima da
     * primeira sem dar por isso.
     */
    async setStatus(
        friendshipId: string,
        de: MembershipStatus[],
        para: MembershipStatus,
        respondedBy: string,
    ): Promise<boolean> {
        const resultado = await this.database.friendship.updateMany({
            where: { id: friendshipId, status: { in: de }, is_deleted: false },
            data: {
                status: para,
                responded_at: new Date(),
                updated_by: respondedBy,
                version: { increment: 1 },
            },
        });

        return resultado.count === 1;
    }

    /** As relações abertas de alguém, com quem está do outro lado. */
    listOpenFor(userId: string, status: MembershipStatus) {
        return this.database.friendship.findMany({
            where: {
                status,
                is_deleted: false,
                OR: [{ userAId: userId }, { userBId: userId }],
            },
            orderBy: [{ responded_at: 'desc' }, { created_at: 'desc' }],
            select: {
                created_at: true,
                responded_at: true,
                requested_by: true,
                userA: { select: PESSOA_SELECT },
                userB: { select: PESSOA_SELECT },
            },
        });
    }
}
