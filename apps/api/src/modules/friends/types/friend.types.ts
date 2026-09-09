/**
 * O par, sempre pela mesma ordem.
 *
 * É isto que faz de (A,B) e (B,A) a mesma linha. A base impõe a ordem
 * com um CHECK; esta função é o lado de cá a cumpri-la, para que a
 * escrita nunca chegue lá ao contrário.
 */
export const parOrdenado = (
    um: string,
    outro: string,
): { userAId: string; userBId: string } =>
    um < outro
        ? { userAId: um, userBId: outro }
        : { userAId: outro, userBId: um };

/** Quem está do outro lado de uma amizade, visto por mim. */
export interface Friend {
    userId: string;
    username: string;
    avatarUrl: string | null;
    level: number;
    /** Desde quando somos amigos, ou quando o pedido foi feito. */
    since: Date;
}

/**
 * Um pedido por responder.
 *
 * O sentido importa: um pedido que me fizeram espera uma resposta minha,
 * um que eu fiz espera pela outra pessoa — e o ecrã tem de mostrar
 * coisas diferentes nos dois casos.
 */
export interface FriendRequest extends Friend {
    direction: 'incoming' | 'outgoing';
}
