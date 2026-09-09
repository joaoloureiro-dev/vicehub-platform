import { MembershipStatus, nivelDoXp } from '@vicehub/database';

import { FriendError } from '../errors/friend.errors.js';
import type { FriendRepository } from '../repositories/friend.repository.js';
import type { Friend, FriendRequest } from '../types/friend.types.js';

/** O que uma linha da base tem, para se lhe tirar o outro lado. */
interface LinhaDeAmizade {
    created_at: Date;
    responded_at: Date | null;
    requested_by: string;
    userA: { id: string; username: string; avatarUrl: string | null; level: number; xp: bigint };
    userB: { id: string; username: string; avatarUrl: string | null; level: number; xp: bigint };
}

/**
 * Amizades.
 *
 * Uma amizade é uma relação entre duas pessoas, não duas. O par está
 * ordenado na base e a ordem é imposta por um CHECK — este serviço nunca
 * precisa de perguntar "de que lado estou": pergunta pelo par e recebe a
 * relação, venha o pedido de quem vier.
 */
export class FriendService {
    constructor(private readonly friendRepository: FriendRepository) { }

    /**
     * Pede amizade a alguém.
     *
     * Pedir a quem já nos pediu **aceita** o pedido dele, em vez de
     * criar um segundo. Querer os dois é ser amigo, e obrigar a pessoa a
     * ir procurar o pedido que já lá estava seria fazer-lhe perder tempo
     * a dizer a mesma coisa por outro caminho.
     */
    async request(
        meId: string,
        otherId: string,
    ): Promise<'requested' | 'accepted'> {
        if (meId === otherId) {
            throw new FriendError(
                'CANNOT_FRIEND_SELF',
                'Não te podes adicionar a ti próprio.',
            );
        }

        await this.requireUser(otherId);

        const aberta = await this.friendRepository.findOpen(meId, otherId);

        if (aberta === null) {
            await this.friendRepository.create(meId, otherId, meId);

            return 'requested';
        }

        if (aberta.status === MembershipStatus.active) {
            throw new FriendError('ALREADY_FRIENDS', 'Já são amigos.');
        }

        if (aberta.requested_by === meId) {
            throw new FriendError(
                'ALREADY_REQUESTED',
                'Já pediste, e falta a resposta.',
            );
        }

        await this.friendRepository.setStatus(
            aberta.id,
            [MembershipStatus.pending],
            MembershipStatus.active,
            meId,
        );

        return 'accepted';
    }

    /** Aceita um pedido que me fizeram. */
    async accept(meId: string, otherId: string): Promise<void> {
        const aberta = await this.requireOpen(meId, otherId);

        if (aberta.status !== MembershipStatus.pending) {
            throw new FriendError('ALREADY_FRIENDS', 'Já são amigos.');
        }

        /**
         * Quem pede não se aceita a si próprio — se não, um pedido era
         * uma amizade com um passo a mais e a resposta da outra pessoa
         * não valia nada.
         */
        if (aberta.requested_by === meId) {
            throw new FriendError(
                'CANNOT_ACCEPT_OWN_REQUEST',
                'Este pedido foi teu: falta a resposta da outra pessoa.',
            );
        }

        const aplicada = await this.friendRepository.setStatus(
            aberta.id,
            [MembershipStatus.pending],
            MembershipStatus.active,
            meId,
        );

        if (!aplicada) {
            throw new FriendError(
                'FRIENDSHIP_NOT_PENDING',
                'Este pedido já foi respondido.',
            );
        }
    }

    /**
     * Diz que não, ou desfaz.
     *
     * É a mesma porta para três coisas — recusar quem me pediu, retirar
     * o que pedi, e acabar uma amizade — porque do lado de quem carrega
     * são a mesma: já não quero isto. O que muda é o que fica gravado,
     * e isso o serviço sabe sem perguntar.
     */
    async remove(meId: string, otherId: string): Promise<void> {
        const aberta = await this.requireOpen(meId, otherId);

        const recusa
            = aberta.status === MembershipStatus.pending
                && aberta.requested_by !== meId;

        await this.friendRepository.setStatus(
            aberta.id,
            [MembershipStatus.pending, MembershipStatus.active],
            recusa ? MembershipStatus.rejected : MembershipStatus.left,
            meId,
        );
    }

    async listFriends(meId: string): Promise<Friend[]> {
        const linhas = await this.friendRepository.listOpenFor(
            meId,
            MembershipStatus.active,
        );

        return linhas.map((linha) => this.outroLado(linha, meId));
    }

    /** Os pedidos por responder, nos dois sentidos. */
    async listRequests(meId: string): Promise<FriendRequest[]> {
        const linhas = await this.friendRepository.listOpenFor(
            meId,
            MembershipStatus.pending,
        );

        return linhas.map((linha) => ({
            ...this.outroLado(linha, meId),
            direction:
                linha.requested_by === meId
                    ? ('outgoing' as const)
                    : ('incoming' as const),
        }));
    }

    /**
     * Quem está do outro lado desta linha.
     *
     * O par é ordenado, e não guarda quem é "eu": é aqui que se decide,
     * comparando com quem pergunta.
     */
    private outroLado(linha: LinhaDeAmizade, meId: string): Friend {
        const outro = linha.userA.id === meId ? linha.userB : linha.userA;

        return {
            userId: outro.id,
            username: outro.username,
            avatarUrl: outro.avatarUrl,
            /** Do xp, como em todo o lado: a coluna é uma cópia. */
            level: nivelDoXp(outro.xp),
            since: linha.responded_at ?? linha.created_at,
        };
    }

    private async requireUser(userId: string): Promise<void> {
        if ((await this.friendRepository.findUser(userId)) === null) {
            throw new FriendError('USER_NOT_FOUND', 'Não encontrámos esta pessoa.');
        }
    }

    private async requireOpen(meId: string, otherId: string) {
        const aberta = await this.friendRepository.findOpen(meId, otherId);

        if (aberta === null) {
            throw new FriendError(
                'FRIENDSHIP_NOT_FOUND',
                'Não há nada entre vocês para responder.',
            );
        }

        return aberta;
    }
}
